import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = 'http://204.168.167.198:3001';

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const path = slug.join('/');
  const url = `${BACKEND_URL}/api/v1/${path}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': request.headers.get('Authorization') || '',
    },
  });

  const data = await res.json();
  return NextResponse.json(data);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const path = slug.join('/');
  const url = `${BACKEND_URL}/api/v1/${path}`;
  const body = await request.json();

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': request.headers.get('Authorization') || '',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  return NextResponse.json(data);
}