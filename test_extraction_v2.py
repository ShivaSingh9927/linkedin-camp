"""Test extraction prompt against user's actual CSV using Qwen2.5-0.5B-Instruct."""
import csv
import json
import re
import sys

try:
    from transformers import AutoModelForCausalLM, AutoTokenizer
    import torch
except ImportError:
    print("Install transformers + torch")
    sys.exit(1)

MODEL = "Qwen/Qwen2.5-0.5B-Instruct"

# Sharp, few-shot prompt
PROMPT = """Extract structured data from a LinkedIn card text.

LinkedIn card text contains noise (profile-view link, "• 2nd", "2nd degree connection", bullets). The actual content is usually one or two lines of "Job Title at Company | Education | Skills" followed by a city.

Return ONLY a JSON object with these keys: company, education, job_profile, field, location
- company: employer name (look for "at X" or "@X" patterns, e.g. "at Meril" → "Meril")
- education: school or degree, NOT "2nd" / "3rd" / "degree connection"
- job_profile: job title only (e.g. "AI Engineer", "Salesperson")
- field: first/primary skill from pipe-separated list (e.g. "NLP | Python | ML" → "NLP")
- location: city on the last line
Use null if a field is missing. No other text.

Example 1:
Card: "AI Engineer at Meril | MTech (Data Science) IIIT Lucknow | Python | Computer Vision
Kanpur"
Output: {"company": "Meril", "education": "MTech (Data Science) IIIT Lucknow", "job_profile": "AI Engineer", "field": "Python", "location": "Kanpur"}

Example 2:
Card: "AI Engineer @ Meril | MTech in Computer Science @ IIT Bhubaneswar
Thane"
Output: {"company": "Meril", "education": "MTech in Computer Science @ IIT Bhubaneswar", "job_profile": "AI Engineer", "field": null, "location": "Thane"}

Example 3:
Card: "Salesperson at Mamaearth"
Output: {"company": "Mamaearth", "education": null, "job_profile": "Salesperson", "field": null, "location": null}

Example 4:
Card: "Shailesh Chaudhary
View Shailesh Chaudhary's profile
• 2nd
2nd degree connection
AI Engineer@Meril | IIT KGP (CSE'24)
Vapi"
Output: {"company": "Meril", "education": "IIT KGP (CSE'24)", "job_profile": "AI Engineer", "field": null, "location": "Vapi"}

Now extract from this card:
Card: "{INFO}"
Output:"""

def extract(model, tokenizer, info_text):
    prompt = PROMPT.replace("{INFO}", info_text)
    messages = [{"role": "user", "content": prompt}]
    text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    inputs = tokenizer(text, return_tensors="pt").to(model.device)
    out = model.generate(**inputs, max_new_tokens=200, do_sample=False, temperature=None, top_p=None, top_k=None)
    reply = tokenizer.decode(out[0][inputs.input_ids.shape[1]:], skip_special_tokens=True).strip()
    # Try parse
    m = re.search(r'\{[\s\S]*\}', reply)
    if m:
        try:
            return json.loads(m.group(0)), reply
        except json.JSONDecodeError:
            pass
    return None, reply

def main():
    print(f"Loading {MODEL}...")
    tok = AutoTokenizer.from_pretrained(MODEL)
    mdl = AutoModelForCausalLM.from_pretrained(MODEL, torch_dtype=torch.float32, device_map="auto")
    print("Loaded.\n")

    with open("smart_list_test5-2026-06-06.csv") as f:
        rows = list(csv.DictReader(f))

    results = []
    for i, r in enumerate(rows[:6]):
        info = r.get("info", "").strip()
        if not info:
            continue
        print(f"\n=== Row {i+1}: {r['firstName']} {r['lastName']} ===")
        print(f"info: {info[:100]!r}...")
        parsed, raw = extract(mdl, tok, info)
        print(f"raw: {raw}")
        print(f"parsed: {parsed}")
        if parsed:
            results.append({"row": i+1, "name": f"{r['firstName']} {r['lastName']}", **parsed})

    print("\n\n=== Summary ===")
    for r in results:
        print(f"  {r['name']:30s} | company={r.get('company')!r:25s} | job={r.get('job_profile')!r:20s} | edu={r.get('education')!r:30s} | loc={r.get('location')!r}")

if __name__ == "__main__":
    main()
