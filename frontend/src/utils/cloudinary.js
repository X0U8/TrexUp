export async function uploadToCloudinary(file) {
  // Pure local blob storage fallback
  const localUrl = URL.createObjectURL(file);
  return {
    public_id: `local_${Date.now()}`,
    asset_id: `local_asset_${Date.now()}`,
    secure_url: localUrl,
    url: localUrl,
  };
}
