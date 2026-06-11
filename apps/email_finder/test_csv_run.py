import asyncio
import csv
from models import GuessEmailRequest
from main import guess_email, _EXPECTED_TOKEN

async def main():
    print(f"Token: {_EXPECTED_TOKEN}")
    results = []
    with open('../../leads-cmq1xepu.csv', 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Name,Company,Job Title,Stage,LinkedIn URL,Last Action At
            name = row.get('Name', '').strip()
            company = row.get('Company', '').strip()
            job = row.get('Job Title', '').strip()
            
            if not name or not company:
                continue
                
            parts = name.split()
            first = parts[0]
            last = " ".join(parts[1:]) if len(parts) > 1 else ""
            
            if not last:
                continue
                
            print(f"Processing: {first} {last} @ {company}")
            req = GuessEmailRequest(
                firstName=first,
                lastName=last,
                company=company,
                jobTitle=job
            )
            
            try:
                res = await guess_email(req)
                print(f"  -> Email: {res.email} (Verified: {res.verified}, Source: {res.source})")
                row['Found Email'] = res.email
                row['Verified'] = res.verified
            except Exception as e:
                print(f"  -> Error: {str(e)}")
                row['Found Email'] = f"Error: {str(e)}"
                row['Verified'] = False
                
            results.append(row)
            
    with open('output_emails.csv', 'w', newline='') as f:
        if results:
            writer = csv.DictWriter(f, fieldnames=list(results[0].keys()))
            writer.writeheader()
            writer.writerows(results)
    
    print("Done. Saved to output_emails.csv")

if __name__ == '__main__':
    asyncio.run(main())
