import { NextRequest, NextResponse } from 'next/server';

export const revalidate = 60; // Cache for 1 minute

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const platform = searchParams.get('platform')?.toLowerCase();

  const fallbackUrl = 'https://github.com/Starz099/rush/releases';

  if (!platform || !['windows', 'macos', 'linux'].includes(platform)) {
    return NextResponse.redirect(fallbackUrl, 302);
  }

  try {
    const res = await fetch(
      'https://api.github.com/repos/Starz099/rush/releases/latest',
      {
        next: { revalidate: 60 },
        headers: {
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'Rush-Video-Editor-Landing',
        },
      },
    );

    if (!res.ok) {
      throw new Error(`GitHub API responded with status ${res.status}`);
    }

    const release = await res.json();
    const assets = release.assets || [];

    let matchedAsset = null;

    if (platform === 'windows') {
      // Look for .exe installers
      matchedAsset = assets.find((asset: any) => asset.name.endsWith('.exe'));
    } else if (platform === 'macos') {
      // Look for .dmg installers
      matchedAsset = assets.find((asset: any) => asset.name.endsWith('.dmg'));
    } else if (platform === 'linux') {
      // Look for .deb packages or .AppImage
      matchedAsset = assets.find(
        (asset: any) =>
          asset.name.endsWith('.deb') || asset.name.endsWith('.AppImage'),
      );
    }

    if (matchedAsset && matchedAsset.browser_download_url) {
      return NextResponse.redirect(matchedAsset.browser_download_url, 302);
    }

    // Fall back to main release page if no direct asset matches
    return NextResponse.redirect(fallbackUrl, 302);
  } catch (error) {
    console.error('Error fetching release download URL:', error);
    return NextResponse.redirect(fallbackUrl, 302);
  }
}
