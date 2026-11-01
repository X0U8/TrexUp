const CLOUD_NAME =
  import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'derh6a4vm';
const API_KEY =
  import.meta.env.VITE_CLOUDINARY_API_KEY || '641179866141334';
const API_SECRET =
  import.meta.env.VITE_CLOUDINARY_API_SECRET || 'SH8LGc73xKrxlsQXPvk1qnIbOM4';

async function generateSha1(message) {
  const msgUint8 = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-1', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function uploadToCloudinary(file) {
  const timestamp = Math.floor(Date.now() / 1000);
  const toSign = `timestamp=${timestamp}${API_SECRET}`;
  const signature = await generateSha1(toSign);

  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', API_KEY);
  formData.append('timestamp', timestamp.toString());
  formData.append('signature', signature);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`,
    {
      method: 'POST',
      body: formData,
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Failed to upload to Cloudinary');
  }

  return response.json();
}
