import csv
import json
import re
import sys
import time
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

CSV_PATH = "/home/shiva/Documents/linkedin-camp/AI_engineer_test_list_3-2026-06-06.csv"

EXTRACTION_PROMPT = """Extract the following from this LinkedIn profile snippet as flat JSON with keys: "company", "education", "job_profile", "field", "location". All values must be strings or null. No arrays.

- company: employer name (look for "at X" or "@X" patterns)
- education: degrees or institutions only. Ignore "1st", "2nd", "3rd", "degree connection" — those are connection badges, NOT education
- job_profile: the job title / role
- field: the main skill or domain from pipe-separated keywords (e.g. "NLP | Python | ML" → "NLP")
- location: city, or city + country (often the last line)

Snippet:
{info_text}"""

def load_model():
    print("Loading Qwen2.5-3B-Instruct (CPU, this may take a while)...")
    model_name = "Qwen/Qwen2.5-3B-Instruct"
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModelForCausalLM.from_pretrained(
        model_name,
        dtype=torch.float32,
        low_cpu_mem_usage=True,
    )
    return model, tokenizer

def extract(model, tokenizer, info_text):
    prompt = EXTRACTION_PROMPT.format(info_text=info_text)
    messages = [{"role": "user", "content": prompt}]
    text = tokenizer.apply_chat_template(messages, tokenize=False)
    inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=2048)
    
    with torch.no_grad():
        outputs = model.generate(
            inputs.input_ids,
            max_new_tokens=256,
            temperature=0.1,
            do_sample=True,
            pad_token_id=tokenizer.eos_token_id,
        )
    
    response = tokenizer.decode(outputs[0][inputs.input_ids.shape[1]:], skip_special_tokens=True)
    
    result = {"company": None, "education": None, "job_profile": None, "field": None, "location": None}
    try:
        json_match = re.search(r'\{[\s\S]*\}', response)
        if json_match:
            result.update(json.loads(json_match[0]))
        else:
            parsed = json.loads(response)
            result.update(parsed)
    except (json.JSONDecodeError, Exception) as e:
        print(f"  Parse failed: {e}")
        print(f"  Raw response: {response[:200]}")
    
    return result

def main():
    model, tokenizer = load_model()
    
    with open(CSV_PATH, "r", newline="") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    
    print(f"\nFound {len(rows)} rows in CSV")
    
    results = []
    for i, row in enumerate(rows):
        info = row.get("info", "").strip()
        name = f"{row.get('firstName', '')} {row.get('lastName', '')}".strip()
        
        if not info:
            print(f"\n[{i+1}/{len(rows)}] {name} — NO INFO FIELD, skipping")
            results.append({**row, **{"company": "", "education": "", "job_profile": "", "field": "", "location": ""}})
            continue
        
        print(f"\n[{i+1}/{len(rows)}] {name}")
        print(f"  Info: {info[:80]}...")
        
        start = time.time()
        extracted = extract(model, tokenizer, info)
        elapsed = time.time() - start
        
        print(f"  Extracted: {json.dumps(extracted)} ({elapsed:.1f}s)")
        
        results.append({**row, **extracted})
    
    print("\n" + "="*80)
    print("SUMMARY — comparing existing vs extracted fields:")
    print("="*80)
    for i, r in enumerate(results):
        name = f"{r.get('firstName', '')} {r.get('lastName', '')}".strip()
        old_company = r.get('company', '') or '(empty)'
        new_company = r.get('company_extracted', r.get('company')) or '(null)'
        # Show comparison for relevant fields
        print(f"\n{name}:")
        print(f"  old company: {r.get('company', '') or '❌ empty'}  →  new: {r.get('company', '')}")
        print(f"  old education: —  →  new: {r.get('education', '') or '—'}")
        print(f"  old job_profile: {r.get('jobTitle', '') or '❌ empty'}  →  new: {r.get('job_profile', '') or '—'}")

if __name__ == "__main__":
    main()
