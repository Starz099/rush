import { NextResponse } from 'next/server';

export const revalidate = 60; // Server-side cache duration: 1 minute (60 seconds)

export async function GET() {
  try {
    const res = await fetch('https://api.github.com/repos/Starz099/rush', {
      next: { revalidate: 60 },
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Rush-Video-Editor-Landing',
      },
    });

    if (!res.ok) {
      throw new Error(`GitHub API responded with status ${res.status}`);
    }

    const data = await res.json();
    const stars = data.stargazers_count || 0;

    return NextResponse.json({ stars });
  } catch (error) {
    console.error('Error fetching GitHub stars:', error);
    return NextResponse.json({ stars: 0 });
  }
}
