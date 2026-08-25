// World sharing via a compressed URL (RHOMBIVERSE_UIUX_BUILD_PLAN.md B6).
// Full design rationale/history for every export below:
// docs/code-notes/app/worldshare.md
export function compressionSupported() {
  return typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';
}

function bytesToBase64Url(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function base64UrlToBytes(b64url) {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function compressToBase64Url(text) {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  const buf = await new Response(stream).arrayBuffer();
  return bytesToBase64Url(new Uint8Array(buf));
}
async function decompressFromBase64Url(encoded) {
  const bytes = base64UrlToBytes(encoded);
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  const buf = await new Response(stream).arrayBuffer();
  return new TextDecoder().decode(buf);
}

function shareableSlice(worldJSON) {
  const { worldName, version, cells, claims, seeds, organisms, meta } = worldJSON;
  return { worldName, version, cells, claims, seeds, organisms, meta };
}

export async function encodeWorldForUrl(worldJSON) {
  const json = JSON.stringify(shareableSlice(worldJSON));
  return compressToBase64Url(json);
}

export async function decodeWorldFromUrl(encoded) {
  const json = await decompressFromBase64Url(encoded);
  return JSON.parse(json);
}

export function buildShareUrl(encoded) {
  const url = new URL(location.href);
  url.hash = '';
  url.search = '';
  url.searchParams.set('w', encoded);
  return url.toString();
}

export function getSharedWorldParam() {
  return new URLSearchParams(location.search).get('w');
}

export function clearSharedWorldParam() {
  const url = new URL(location.href);
  url.searchParams.delete('w');
  history.replaceState(null, '', url.toString());
}
