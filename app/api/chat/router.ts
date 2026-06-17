import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { message } = await req.json();

    const response = await fetch("https://api-inference.huggingface.co/models/facebook/blenderbot-400M-distill", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.NEXT_Hugging_API_Key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: message }),
    });

    const data = await response.json();
    const reply = data[0]?.generated_text || "I'm not sure how to respond to that.";
    
    return NextResponse.json({ reply });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}