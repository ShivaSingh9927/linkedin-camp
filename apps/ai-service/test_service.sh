#!/bin/bash

# Base URL of the AI Service
BASE_URL="http://localhost:8001"

echo "Testing /ai/comment..."
curl -X POST "$BASE_URL/ai/comment" \
     -H "Content-Type: application/json" \
     -d '{
           "profile_name": "Elon Musk",
           "profile_headline": "CEO of Tesla & SpaceX",
           "post_content": "Just launched another 60 Starlink satellites! The goal is global high-speed internet for all.",
           "tone": "professional"
         }'
echo -e "\n\nTesting /ai/message..."
curl -X POST "$BASE_URL/ai/message" \
     -H "Content-Type: application/json" \
     -d '{
           "recipient_name": "Satya Nadella",
           "recipient_headline": "CEO of Microsoft",
           "connection_context": "Interested in Azure and AI collaboration",
           "tone": "professional"
         }'
echo -e "\n\nTesting /ai/enhance..."
curl -X POST "$BASE_URL/ai/enhance" \
     -H "Content-Type: application/json" \
     -d '{
           "original_message": "Hi, I'\''m looking for a new opportunity in software engineering.",
           "draft_reply": "I saw your job post and I think I am a good fit. I have 5 years of experience with React.",
           "tone": "professional"
         }'
echo -e "\n"
