import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { userInput, systemPrompt, jsonSchema } = await req.json();

        // The key stays secure on your backend server. No "NEXT_PUBLIC_" prefix needed.
        const apiKey = process.env.XAI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: "Server configuration missing API key." }, { status: 500 });
        }

        const response = await fetch('https://api.x.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'grok-2-1212',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userInput }
                ],
                response_format: {
                    type: "json_schema",
                    json_schema: jsonSchema
                },
                temperature: 0.1,
            }),
        });

        if (!response.ok) {
            const errText = await response.text();
            return NextResponse.json({ error: `xAI Error: ${errText}` }, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}