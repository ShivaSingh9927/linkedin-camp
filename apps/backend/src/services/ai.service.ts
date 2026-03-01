export const generateIcebreaker = async (lead: any) => {
    const { firstName, jobTitle, company } = lead;

    if (!firstName || !jobTitle || !company) {
        return `Hi ${firstName || 'there'}, I noticed your profile and would love to connect!`;
    }

    try {
        const payload = {
            model: "gpt-oss:20b",
            prompt: `
            You are a professional LinkedIn outreach expert. 
            Generate a short, friendly, and highly personalized 1-sentence icebreaker for a connection request.
            Lead Name: ${firstName}, Job Title: ${jobTitle}, Company: ${company}. 
            Make it specifically about their role or company.
            Only return the icebreaker text, nothing else.
            `,
            stream: false,
            options: {
                temperature: 0.7
            }
        };

        const response = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            throw new Error(`Ollama error: ${response.statusText}`);
        }

        const data = await response.json() as { response: string };
        return data.response.trim() || `Hi ${firstName}, I'm impressed by your work at ${company}!`;
    } catch (error) {
        console.error('Ollama Personalization error:', error);
        return `Hi ${firstName}, I came across your profile and was impressed by your experience at ${company}.`;
    }
};
