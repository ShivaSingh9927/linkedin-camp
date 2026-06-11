import asyncio
from models import GuessEmailRequest
from main import guess_email

async def main():
    req = GuessEmailRequest(
        firstName="Prateek",
        lastName="Srivastava",
        company="Couture.ai",
        jobTitle=""
    )
    print("Testing Prateek Srivastava @ Couture.ai after resolver patch...")
    res = await guess_email(req)
    print(f"Result -> Success: {res.success}, Email: {res.email}, Verified: {res.verified}, Domain: {res.domain}, Method: {res.source}")

if __name__ == '__main__':
    asyncio.run(main())
