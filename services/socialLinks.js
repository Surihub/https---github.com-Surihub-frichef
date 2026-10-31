import { youtubeUrl } from '../components/recipeFormat.js';

export function socialLink(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    const youtube = youtubeUrl(value);
    if (youtube) return { platform: 'youtube', url: youtube };
    if (!['instagram.com', 'www.instagram.com', 'm.instagram.com'].includes(url.hostname)) return null;
    const match = url.pathname.match(/^\/(p|reel|reels|tv)\/([\w-]+)\/?$/);
    return match ? { platform: 'instagram', url: `https://www.instagram.com/${match[1] === 'reels' ? 'reel' : match[1]}/${match[2]}/` } : null;
  } catch { return null; }
}

export const socialItemLink = item => socialLink(item.socialUrl || item.instagramUrl || item.youtubeUrl);
export function socialImageUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && ['.cdninstagram.com', '.fbcdn.net', '.ytimg.com'].some(domain => url.hostname.endsWith(domain)) ? url.href : '';
  } catch { return ''; }
}
