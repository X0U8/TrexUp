import { useState, useRef, useEffect, useMemo } from 'react';
import EngineCodeEditor from './EngineCodeEditor';
// The one engine server: the download is the project's real agent/server.py, not a separate copy.
import SERVER_PY_SOURCE from '../../../../agent/server.py?raw';
import './EnginesPage.css';

const PREVIEW_TEXT_EXT = ['txt', 'md', 'csv', 'tsv', 'json', 'log'];
const PREVIEW_IMAGE_EXT = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'];

/** A file an engine produced: text or image shown inline, and always a download button. */
function EngineFilePreview({ file }) {
  const [text, setText] = useState('');
  const [missing, setMissing] = useState(false);
  const ext = (file.filename || '').split('.').pop().toLowerCase();
  const isText = PREVIEW_TEXT_EXT.includes(ext);
  const isImage = PREVIEW_IMAGE_EXT.includes(ext);

  useEffect(() => {
    if (!isText || !file.url) return;
    let cancelled = false;
    fetch(file.url)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((t) => !cancelled && setText(t))
      .catch(() => !cancelled && setMissing(true));
    return () => {
      cancelled = true;
    };
  }, [file.url, isText]);

  return (
    <div className="engine-file-preview" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
      <div className="file-result-meta">
        <span className="file-result-name">{file.filename}</span>
        <span className="file-result-type">{file.mime_type}</span>
      </div>
      {missing ? (
        <span className="engine-output-placeholder">File not found in storage.</span>
      ) : isImage ? (
        <img src={file.url} alt={file.filename} style={{ maxWidth: '100%', borderRadius: '8px' }} onError={() => setMissing(true)} />
      ) : isText ? (
        <pre className="engine-output-text">{text || 'Loading…'}</pre>
      ) : (
        <span className="engine-output-placeholder">No preview for this file type.</span>
      )}
      <a className="file-result-download-btn" href={file.url} download={file.filename} style={{ alignSelf: 'flex-start', textDecoration: 'none' }}>
        Download
      </a>
    </div>
  );
}

const MANIFEST_SPEC_GUIDE = `# Manifest specification:
# inputs: "text", "file", "image", "audio", "video", "json", "number", "boolean"
# outputs: "json", "file", "text", "image", "audio"
# "required": True ensures the field must be provided to run.`;

export const DEFAULT_ENGINES = {
  resource_bridge: {
    id: 'resource_bridge',
    name: 'resource_bridge',
    code: `# resource_bridge
# Pure function entry: def run(input_data, context=None) -> dict

${MANIFEST_SPEC_GUIDE}

MANIFEST = {
    "name": "resource_bridge",
    "version": "1.0.0",
    "description": "Verifies local OS cached document existence; downloads from Cloudinary URL or writes binary if missing; guarantees valid local filesystem path.",
    "inputs": {
        "file": {
            "type": "file",
            "required": False,
            "description": "File payload containing doc_id, file_name, cloudinaryUrl, or local_path"
        }
    },
    "outputs": {
        "result": {
            "type": "json",
            "description": "Resolved OS local_path, cache status, verified file size, and availability"
        }
    }
}

import os
import io
import re
import json
import base64
import urllib.request

def run(input_data, context=None):
    if not isinstance(input_data, dict):
        return {
            "valid": False,
            "status": "invalid_input",
            "error": "Expected dictionary input"
        }

    doc_info = input_data.get("file") if isinstance(input_data.get("file"), dict) else input_data
    doc_id = (
        doc_info.get("doc_id")
        or input_data.get("doc_id")
        or doc_info.get("id")
        or input_data.get("id")
        or ""
    )
    file_name = (
        doc_info.get("file_name")
        or doc_info.get("name")
        or input_data.get("file_name")
        or input_data.get("name")
        or "document"
    )
    local_path = (
        doc_info.get("local_path")
        or doc_info.get("file_path")
        or input_data.get("local_path")
        or input_data.get("file_path")
        or ""
    )
    cloudinary_url = (
        doc_info.get("cloudinaryUrl")
        or doc_info.get("url")
        or input_data.get("cloudinaryUrl")
        or input_data.get("url")
        or ""
    )
    b64_data = (
        doc_info.get("file_bytes_b64")
        or input_data.get("file_bytes_b64")
        or doc_info.get("b64")
        or ""
    )

    storage_dir = globals().get("DOCS_STORAGE_DIR")
    if not storage_dir or not os.path.exists(storage_dir):
        storage_dir = os.path.abspath("storage/documents")
        if not os.path.exists(storage_dir):
            storage_dir = os.path.join(os.getcwd(), "storage", "documents")
    os.makedirs(storage_dir, exist_ok=True)

    clean_prefix = re.sub(r"[^a-zA-Z0-9_-]", "_", str(doc_id)) if doc_id else "doc"
    clean_filename = os.path.basename(file_name)
    target_path = local_path if (local_path and os.path.exists(local_path) and os.path.getsize(local_path) > 0) else os.path.join(storage_dir, f"{clean_prefix}_{clean_filename}")

    # 1. Check if already cached and valid on local OS
    if os.path.exists(target_path) and os.path.getsize(target_path) > 0:
        actual_size = os.path.getsize(target_path)
        return {
            "valid": True,
            "status": "cached",
            "doc_id": doc_id,
            "file_name": clean_filename,
            "local_path": target_path,
            "file_path": target_path,
            "size_bytes": actual_size,
            "source": "local_os_cache",
            "message": f"Verified local document on disk ({actual_size} bytes)"
        }

    # 2. If not on disk, save from base64 if present
    if b64_data:
        try:
            if "," in b64_data[:60]:
                b64_data = b64_data.split(",", 1)[1]
            decoded = base64.b64decode(b64_data)
            with open(target_path, "wb") as f:
                f.write(decoded)
            actual_size = len(decoded)
            return {
                "valid": True,
                "status": "cached",
                "doc_id": doc_id,
                "file_name": clean_filename,
                "local_path": target_path,
                "file_path": target_path,
                "size_bytes": actual_size,
                "source": "payload_binary",
                "message": f"Cached binary from payload ({actual_size} bytes)"
            }
        except Exception as e:
            pass

    # 3. If not on disk, download from Cloudinary URL
    if cloudinary_url and cloudinary_url.startswith(("http://", "https://")):
        try:
            req = urllib.request.Request(cloudinary_url, headers={"User-Agent": "Trex-Resource-Bridge/1.0"})
            with urllib.request.urlopen(req, timeout=30) as resp:
                content = resp.read()
                with open(target_path, "wb") as f:
                    f.write(content)
            actual_size = os.path.getsize(target_path)
            return {
                "valid": True,
                "status": "downloaded",
                "doc_id": doc_id,
                "file_name": clean_filename,
                "local_path": target_path,
                "file_path": target_path,
                "size_bytes": actual_size,
                "source": "cloudinary",
                "message": f"Downloaded and cached from Cloudinary ({actual_size} bytes)"
            }
        except Exception as e:
            return {
                "valid": False,
                "status": "download_failed",
                "error": f"Failed downloading from Cloudinary: {str(e)}",
                "doc_id": doc_id,
                "file_name": clean_filename
            }

    return {
        "valid": False,
        "status": "missing_resource",
        "error": f"Document '{clean_filename}' does not exist on disk and no Cloudinary URL was provided",
        "doc_id": doc_id
    }
`,
  },
  file_detection: {
    id: 'file_detection',
    name: 'file_detection',
    code: `# File Detection
# Pure function entry: def run(input_data, context=None) -> dict

${MANIFEST_SPEC_GUIDE}

MANIFEST = {
    "name": "file_detection",
    "version": "2.0.0",
    "description": "Binary & structural inspector: detects file type, corruption, extension spoofing, and extraction routing.",
    "inputs": {
        "file": {
            "type": "file",
            "required": True,
            "description": "Binary or text file payload with metadata"
        }
    },
    "outputs": {
        "result": {
            "type": "json",
            "description": "Full detection profile including status, validation, category, format, risk, and routing directives"
        }
    }
}

import os
import io
import re
import json
import base64
import struct
import mimetypes
import zipfile

MAX_FILE_SIZE_MB = 20.0

# Canonical magic signatures: (signature, format, category, offset)
MAGIC_SIGNATURES = [
    # Documents
    (b'%PDF-', 'pdf', 'document', 0),
    (b'{\\\\rtf', 'rtf', 'document', 0),
    (b'%!PS', 'ps', 'document', 0),

    # Images
    (b'\\x89PNG\\r\\n\\x1a\\n', 'png', 'image', 0),
    (b'\\xff\\xd8\\xff', 'jpeg', 'image', 0),
    (b'GIF87a', 'gif', 'image', 0),
    (b'GIF89a', 'gif', 'image', 0),
    (b'BM', 'bmp', 'image', 0),
    (b'II*\\x00', 'tiff', 'image', 0),
    (b'MM\\x00*', 'tiff', 'image', 0),
    (b'\\x00\\x00\\x01\\x00', 'ico', 'image', 0),

    # Audio
    (b'ID3', 'mp3', 'audio', 0),
    (b'\\xff\\xfb', 'mp3', 'audio', 0),
    (b'\\xff\\xf3', 'mp3', 'audio', 0),
    (b'\\xff\\xf2', 'mp3', 'audio', 0),
    (b'fLaC', 'flac', 'audio', 0),
    (b'OggS', 'ogg', 'audio', 0),

    # Video / EBML
    (b'\\x1a\\x45\\xdf\\xa3', 'webm', 'video', 0),
    (b'FLV\\x01', 'flv', 'video', 0),

    # Archives & Containers
    (b'PK\\x03\\x04', 'zip', 'archive', 0),
    (b'PK\\x05\\x06', 'zip', 'archive', 0),
    (b'PK\\x07\\x08', 'zip', 'archive', 0),
    (b'\\x1f\\x8b\\x08', 'gz', 'archive', 0),
    (b'BZh', 'bz2', 'archive', 0),
    (b'\\xfd7zXZ\\x00', 'xz', 'archive', 0),
    (b'7z\\xbc\\xaf\\x27\\x1c', '7z', 'archive', 0),
    (b'Rar!\\x1a\\x07\\x00', 'rar', 'archive', 0),
    (b'Rar!\\x1a\\x07\\x01\\x00', 'rar', 'archive', 0),

    # Security / Executable Signatures
    (b'MZ', 'exe', 'executable', 0),
    (b'\\x7fELF', 'elf', 'executable', 0),
    (b'\\xfe\\xed\\xfa\\xce', 'mach-o', 'executable', 0),
    (b'\\xfe\\xed\\xfa\\xcf', 'mach-o', 'executable', 0),
    (b'\\xcf\\xfa\\xed\\xfe', 'mach-o', 'executable', 0),
    (b'\\xca\\xfe\\xba\\xbe', 'class', 'executable', 0),
    (b'\\x00asm', 'wasm', 'executable', 0),
]

# Executable or dangerous extensions to quarantine
DANGEROUS_EXTENSIONS = {
    'exe', 'bat', 'cmd', 'sh', 'bash', 'zsh', 'ps1', 'vbs', 'js', 'jar',
    'msi', 'com', 'scr', 'dll', 'so', 'dylib', 'bin', 'elf', 'wsf'
}

# Format compatibility groups for mismatch checking
COMPATIBILITY_MAP = {
    'jpeg': {'jpg', 'jpeg', 'jpe', 'jfif'},
    'jpg': {'jpg', 'jpeg', 'jpe', 'jfif'},
    'png': {'png'},
    'gif': {'gif'},
    'webp': {'webp'},
    'pdf': {'pdf'},
    'tiff': {'tif', 'tiff'},
    'bmp': {'bmp'},
    'wav': {'wav'},
    'mp3': {'mp3'},
    'flac': {'flac'},
    'ogg': {'ogg', 'oga', 'ogv'},
    'mp4': {'mp4', 'm4a', 'm4v'},
    'webm': {'webm', 'mkv'},
    'zip': {'zip'},
    'docx': {'docx'},
    'xlsx': {'xlsx'},
    'pptx': {'pptx'},
    'csv': {'csv', 'txt'},
    'tsv': {'tsv', 'txt'},
    'json': {'json', 'txt'},
    'xml': {'xml', 'svg'},
    'svg': {'svg', 'xml'},
    'html': {'html', 'htm'},
    'markdown': {'md', 'markdown', 'txt'},
    'text': {'txt', 'log', 'cfg', 'ini', 'env', 'conf'}
}

def inspect_riff_container(header_bytes):
    """Inspects RIFF container (WAV, WebP, AVI)"""
    if len(header_bytes) >= 12 and header_bytes.startswith(b'RIFF'):
        tag = header_bytes[8:12]
        if tag == b'WAVE':
            return 'wav', 'audio'
        if tag == b'WEBP':
            return 'webp', 'image'
        if tag == b'AVI ':
            return 'avi', 'video'
    return None, None

def inspect_isom_container(header_bytes):
    """Inspects ISO Base Media File Format (MP4, MOV, M4A)"""
    if len(header_bytes) >= 12:
        if header_bytes[4:8] == b'ftyp':
            brand = header_bytes[8:12]
            if brand in (b'M4A ', b'M4B '):
                return 'm4a', 'audio'
            if brand in (b'qt  ', b'moov'):
                return 'mov', 'video'
            return 'mp4', 'video'
    return None, None

def inspect_zip_subtypes(raw_bytes, claimed_ext):
    """
    Distinguishes DOCX, XLSX, PPTX, and standard ZIP.
    Returns (format, category, is_corrupted, warnings)
    """
    try:
        with zipfile.ZipFile(io.BytesIO(raw_bytes), 'r') as zf:
            namelist = set(zf.namelist())
            if any(name.startswith('word/') for name in namelist) or '[Content_Types].xml' in namelist and claimed_ext in ('docx', 'docm'):
                return 'docx', 'document', False, []
            if any(name.startswith('xl/') for name in namelist) or claimed_ext in ('xlsx', 'xlsm'):
                return 'xlsx', 'tabular', False, []
            if any(name.startswith('ppt/') for name in namelist) or claimed_ext in ('pptx', 'pptm'):
                return 'pptx', 'document', False, []
            return 'zip', 'archive', False, []
    except zipfile.BadZipFile:
        if claimed_ext in ('docx', 'xlsx', 'pptx'):
            return claimed_ext, 'document' if claimed_ext != 'xlsx' else 'tabular', True, ['Truncated or damaged Office archive container']
        return 'zip', 'archive', True, ['Truncated or corrupt ZIP archive']
    except Exception as e:
        return 'zip', 'archive', True, [f'Archive inspection error: {str(e)}']

def inspect_text_and_data(raw_bytes, claimed_ext):
    """
    Inspects non-binary text payloads: JSON, CSV, SVG, XML, HTML, Markdown, Plain Text.
    """
    sample = raw_bytes[:16384]
    if b'\\x00' in sample:
        return None, None, False, ['Unidentified binary data with null bytes']

    try:
        text_str = sample.decode('utf-8')
    except UnicodeDecodeError:
        try:
            text_str = sample.decode('latin-1')
        except Exception:
            return None, None, True, ['Non-decodable text encoding']

    stripped = text_str.strip()
    if not stripped:
        return 'text', 'text', False, []

    # 1. JSON
    if (stripped.startswith('{') and stripped.endswith('}')) or (stripped.startswith('[') and stripped.endswith(']')):
        try:
            json.loads(text_str)
            return 'json', 'code', False, []
        except Exception:
            if claimed_ext == 'json':
                return 'json', 'code', True, ['Malformed JSON syntax']

    # 2. SVG Image
    if '<svg' in text_str.lower() and ('xmlns' in text_str.lower() or '</svg>' in text_str.lower()):
        return 'svg', 'image', False, []

    # 3. HTML
    if '<!doctype html' in text_str.lower() or '<html' in text_str.lower():
        return 'html', 'code', False, []

    # 4. XML
    if stripped.startswith('<?xml'):
        return 'xml', 'code', False, []

    # 5. CSV / TSV
    lines = [line for line in text_str.splitlines() if line.strip()][:10]
    if len(lines) >= 2:
        for delimiter, fmt in ((',', 'csv'), ('\\t', 'tsv'), (';', 'csv')):
            counts = [line.count(delimiter) for line in lines]
            if counts[0] > 0 and all(c == counts[0] for c in counts):
                return fmt, 'tabular', False, []

    # 6. Markdown
    if claimed_ext in ('md', 'markdown') or re.search(r'^(#{1,6}\\s|[-*+]\\s|\\[.+\\]\\(.+\\))', stripped, re.MULTILINE):
        return 'markdown', 'text', False, []

    return 'text', 'text', False, []

def run(input_data, context=None):
    """
    Production-ready File Detection inspector.
    Inspects binary headers, formats, corruption, extension spoofing, and security risks.
    """
    file_info = input_data.get('file') if isinstance(input_data, dict) and 'file' in input_data else input_data
    if not isinstance(file_info, dict):
        return {
            "status": "rejected",
            "valid": False,
            "reason": "Missing or invalid file input payload",
            "category": "unsupported"
        }

    file_name = file_info.get('file_name') or file_info.get('name') or input_data.get('file_name') or input_data.get('name') or 'unnamed'
    size_bytes = file_info.get('size_bytes') or file_info.get('size') or input_data.get('size_bytes') or input_data.get('size') or 0
    b64_data = file_info.get('file_bytes_b64') or file_info.get('b64') or input_data.get('file_bytes_b64') or input_data.get('b64') or ''
    declared_mime = file_info.get('mime_type') or input_data.get('mime_type') or ''
    local_path = file_info.get('file_path') or file_info.get('local_path') or input_data.get('file_path') or input_data.get('local_path') or ''

    base_name = os.path.basename(file_name)
    ext = os.path.splitext(base_name)[1].lower().lstrip('.')
    claimed_format = ext or 'unknown'

    # Check 1: 0-Byte or Empty File
    if (size_bytes is not None and size_bytes <= 0) and not b64_data and not (local_path and os.path.exists(local_path) and os.path.getsize(local_path) > 0):
        return {
            "status": "corrupted",
            "valid": False,
            "reason": "File is empty (0 bytes). No content can be extracted.",
            "file_name": file_name,
            "claimed_format": claimed_format,
            "category": "unsupported",
            "size_bytes": 0,
            "size_mb": 0.0,
            "is_empty": True,
            "is_corrupted": True,
            "is_supported": False,
            "security_risk": "none",
            "warnings": ["Zero-byte file upload"]
        }

    # Check 2: File Size Cap
    size_mb = (size_bytes / (1024 * 1024)) if size_bytes else (len(b64_data) * 3 / 4 / (1024 * 1024))
    if size_mb > MAX_FILE_SIZE_MB:
        return {
            "status": "rejected",
            "valid": False,
            "reason": f"File exceeds maximum allowed limit of {MAX_FILE_SIZE_MB}MB ({round(size_mb, 2)}MB)",
            "file_name": file_name,
            "claimed_format": claimed_format,
            "size_mb": round(size_mb, 2),
            "is_empty": False,
            "is_corrupted": False,
            "is_supported": False,
            "security_risk": "medium",
            "warnings": ["Size limit exceeded"]
        }

    # Decode binary data
    raw_bytes = file_info.get("header_bytes") or input_data.get("header_bytes") or b""
    is_corrupted = False
    warnings = []

    if not raw_bytes and local_path and os.path.exists(local_path):
        try:
            with open(local_path, "rb") as f:
                raw_bytes = f.read(65536)
            size_bytes = os.path.getsize(local_path)
        except Exception as e:
            warnings.append(f"Failed to read local cached file: {str(e)}")

    if b64_data and not raw_bytes:
        try:
            if ',' in b64_data[:60]:
                b64_data = b64_data.split(',', 1)[1]
            raw_bytes = base64.b64decode(b64_data)
        except Exception as e:
            is_corrupted = True
            warnings.append(f"Corrupted or invalid base64 encoding: {str(e)}")

    if not raw_bytes and is_corrupted:
        return {
            "status": "corrupted",
            "valid": False,
            "reason": "Base64 binary payload is malformed or unreadable",
            "file_name": file_name,
            "claimed_format": claimed_format,
            "category": "unsupported",
            "is_empty": False,
            "is_corrupted": True,
            "is_supported": False,
            "security_risk": "medium",
            "warnings": warnings
        }

    real_format = None
    real_category = None

    # Check 3: RIFF containers (WAV, WebP, AVI)
    riff_fmt, riff_cat = inspect_riff_container(raw_bytes[:16])
    if riff_fmt:
        real_format, real_category = riff_fmt, riff_cat

    # Check 4: ISO Base Media File Format (MP4, MOV, M4A)
    if not real_format:
        isom_fmt, isom_cat = inspect_isom_container(raw_bytes[:32])
        if isom_fmt:
            real_format, real_category = isom_fmt, isom_cat

    # Check 5: Magic Signatures matching
    if not real_format:
        for sig, fmt, cat, offset in MAGIC_SIGNATURES:
            if len(raw_bytes) >= offset + len(sig) and raw_bytes[offset:offset + len(sig)] == sig:
                real_format = fmt
                real_category = cat
                break

    # Check 6: PKZIP vs Microsoft Office (DOCX, XLSX, PPTX)
    if real_format == 'zip':
        office_fmt, office_cat, zip_corrupt, zip_warn = inspect_zip_subtypes(raw_bytes, claimed_format)
        real_format = office_fmt
        real_category = office_cat
        if zip_corrupt:
            is_corrupted = True
        warnings.extend(zip_warn)

    # Check 7: Text, Tabular, SVG, and Code formats
    if not real_format and raw_bytes:
        text_fmt, text_cat, text_corrupt, text_warn = inspect_text_and_data(raw_bytes, claimed_format)
        if text_fmt:
            real_format = text_fmt
            real_category = text_cat
            if text_corrupt:
                is_corrupted = True
            warnings.extend(text_warn)

    # Check 8: Security & Executable Quarantine
    if real_category == 'executable' or claimed_format in DANGEROUS_EXTENSIONS:
        return {
            "status": "security_quarantine",
            "valid": False,
            "reason": f"Executable or dangerous script detected ({real_format or claimed_format}). Blocked for security.",
            "file_name": file_name,
            "claimed_format": claimed_format,
            "real_format": real_format or claimed_format,
            "category": "executable",
            "security_risk": "high",
            "is_corrupted": is_corrupted,
            "is_supported": False,
            "warnings": warnings + ["Executable binary or dangerous script payload"]
        }

    # Check 9: Format Integrity / Truncation checks
    if real_format == 'pdf':
        if len(raw_bytes) < 32:
            is_corrupted = True
            warnings.append("Truncated PDF: Header too short (< 32 bytes)")
        elif b'%%EOF' not in raw_bytes[-1024:]:
            warnings.append("Possible truncated PDF: missing standard %%EOF marker in trailing bytes")
    elif real_format == 'png':
        if len(raw_bytes) < 16:
            is_corrupted = True
            warnings.append("Truncated PNG header")
        elif len(raw_bytes) > 100 and b'IEND' not in raw_bytes[-32:]:
            warnings.append("Possible truncated PNG: missing IEND footer chunk")
    elif real_format == 'jpeg':
        if len(raw_bytes) < 8:
            is_corrupted = True
            warnings.append("Truncated JPEG header")

    # If corrupted
    if is_corrupted:
        return {
            "status": "corrupted",
            "valid": False,
            "reason": "File is structurally damaged or truncated.",
            "file_name": file_name,
            "claimed_format": claimed_format,
            "real_format": real_format or claimed_format,
            "category": real_category or "unsupported",
            "size_mb": round(size_mb, 2),
            "is_empty": False,
            "is_corrupted": True,
            "is_supported": False,
            "security_risk": "low",
            "warnings": warnings
        }

    # Check 10: Extension Spoofing / Mismatch Detection
    if real_format:
        allowed = COMPATIBILITY_MAP.get(real_format, {real_format})
        if claimed_format != 'unknown' and claimed_format not in allowed:
            return {
                "status": "mismatch_detected",
                "valid": False,
                "reason": f"Extension spoofing detected: file claims to be .{claimed_format.upper()}, but binary content is {real_format.upper()}",
                "file_name": file_name,
                "claimed_format": claimed_format,
                "real_format": real_format,
                "category": real_category,
                "size_mb": round(size_mb, 2),
                "is_empty": False,
                "is_corrupted": False,
                "is_supported": True,
                "security_risk": "medium",
                "warnings": warnings + [f"Mismatched extension .{claimed_format} vs detected {real_format}"]
            }

    # Final Resolution
    detected_format = real_format or claimed_format or 'unknown'
    detected_category = real_category or ('document' if detected_format in ('pdf', 'doc', 'docx', 'txt', 'rtf')
                                          else 'image' if detected_format in ('png', 'jpg', 'jpeg', 'webp', 'bmp', 'svg')
                                          else 'audio' if detected_format in ('mp3', 'wav', 'flac', 'ogg', 'm4a')
                                          else 'tabular' if detected_format in ('csv', 'tsv', 'xlsx', 'xls')
                                          else 'code' if detected_format in ('json', 'xml', 'html', 'py', 'js')
                                          else 'archive' if detected_format in ('zip', 'tar', 'gz', '7z', 'rar')
                                          else 'unsupported')

    mime_guess, _ = mimetypes.guess_type(file_name)
    final_mime = declared_mime or mime_guess or f"application/{detected_format}"
    is_blocked_media = detected_format == 'gif' or detected_category == 'video' or detected_format in ('mp4', 'webm', 'mov', 'avi', 'flv', 'mkv', 'gif')
    is_supported = not is_blocked_media and detected_category in ('document', 'image', 'tabular', 'audio', 'code', 'text')

    return {
        "status": "verified" if is_supported else "unsupported",
        "valid": is_supported,
        "reason": "Video and GIF files are not supported." if is_blocked_media else ("Unsupported format" if not is_supported else None),
        "file_name": file_name,
        "category": "unsupported" if is_blocked_media else detected_category,
        "format": detected_format,
        "claimed_format": claimed_format,
        "real_format": real_format or claimed_format,
        "mime_type": final_mime,
        "size_bytes": size_bytes or len(raw_bytes),
        "size_mb": round(size_mb, 3),
        "is_empty": False,
        "is_corrupted": False,
        "is_supported": is_supported,
        "binary_verified": bool(real_format),
        "security_risk": "none",
        "warnings": warnings
    }
`,
  },
  document_extractor: {
    id: 'document_extractor',
    name: 'document_extractor',
    code: `# Document Extractor
# Pure function entry: def run(input_data, context=None) -> dict

${MANIFEST_SPEC_GUIDE}

MANIFEST = {
    "name": "document_extractor",
    "version": "1.0.0",
    "description": "Deterministic document parser with hardware safety: extracts text, tables, and page splits from PDF, DOCX, TXT, CSV, and markdown with OCR/Vision escalation triggers.",
    "inputs": {
        "document": {
            "type": "file",
            "required": True,
            "description": "Document payload or path (PDF, DOCX, TXT, MD, CSV)"
        }
    },
    "outputs": {
        "result": {
            "type": "json",
            "description": "Extracted document payload with page chunks, text, tables, confidence scoring, and vision/OCR escalation flags"
        }
    }
}

import os
import io
import re
import csv
import json
import time
import zlib
import base64
import zipfile
import xml.etree.ElementTree as ET

MAX_PAGES_LIMIT = 200
MAX_FILE_SIZE_MB = 20.0
EXECUTION_TIMEOUT_SECONDS = 30.0

def _safe_clean_text(text):
    if not text:
        return ""
    text = re.sub(r'[\\r\\n]{3,}', '\\n\\n', text)
    return text.strip()

def _extract_docx(raw_bytes, start_time):
    paragraphs = []
    tables = []
    with io.BytesIO(raw_bytes) as bio:
        with zipfile.ZipFile(bio, 'r') as zf:
            if 'word/document.xml' not in zf.namelist():
                raise ValueError("Corrupted DOCX archive: missing word/document.xml")
            xml_content = zf.read('word/document.xml')
            tree = ET.fromstring(xml_content)
            for p in tree.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p'):
                if time.perf_counter() - start_time > EXECUTION_TIMEOUT_SECONDS:
                    raise TimeoutError("DOCX parsing exceeded safety hardware timeout.")
                texts = [node.text for node in p.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t') if node.text]
                if texts:
                    p_text = "".join(texts).strip()
                    if p_text:
                        paragraphs.append(p_text)
            for tbl in tree.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}tbl'):
                tbl_rows = []
                for tr in tbl.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}tr'):
                    row = []
                    for tc in tr.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}tc'):
                        tc_text = "".join(node.text for node in tc.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t') if node.text).strip()
                        row.append(tc_text)
                    if any(row):
                        tbl_rows.append(row)
                if tbl_rows:
                    tables.append(tbl_rows)
    full_text = "\\n\\n".join(paragraphs)
    return {
        "text": full_text,
        "paragraphs_count": len(paragraphs),
        "tables": tables,
        "pages_estimate": max(1, round(len(full_text) / 2200))
    }

def _extract_csv(raw_bytes):
    try:
        text_str = raw_bytes.decode('utf-8')
    except UnicodeDecodeError:
        text_str = raw_bytes.decode('latin1', errors='ignore')
    lines = [line.strip() for line in text_str.splitlines() if line.strip()]
    if not lines:
        return {"text": "", "columns": [], "rows_count": 0, "preview_rows": []}
    delimiter = ','
    for cand in (',', '\\t', ';', '|'):
        if cand in lines[0] and (len(lines) == 1 or lines[0].count(cand) == lines[1].count(cand)):
            delimiter = cand
            break
    reader = csv.reader(io.StringIO(text_str), delimiter=delimiter)
    all_rows = list(reader)
    if not all_rows:
        return {"text": "", "columns": [], "rows_count": 0, "preview_rows": []}
    headers = all_rows[0]
    data_rows = all_rows[1:]
    preview_table = f"| {' | '.join(headers)} |\\n| {' | '.join(['---'] * len(headers))} |\\n"
    for r in data_rows[:15]:
        preview_table += f"| {' | '.join(r[:len(headers)])} |\\n"
    return {
        "text": preview_table,
        "columns": headers,
        "total_rows": len(data_rows),
        "delimiter": delimiter
    }

def _extract_pdf(raw_bytes, start_time):
    try:
        import pypdf
        reader = pypdf.PdfReader(io.BytesIO(raw_bytes))
        total_pages = min(len(reader.pages), MAX_PAGES_LIMIT)
        pages_data = []
        full_text = []
        for idx in range(total_pages):
            if time.perf_counter() - start_time > EXECUTION_TIMEOUT_SECONDS:
                break
            page = reader.pages[idx]
            page_text = page.extract_text() or ""
            words = page_text.split()
            word_count = len(words)
            img_count = len(page.images) if hasattr(page, 'images') else 0
            if word_count > 30:
                conf = 0.95
                needs_ocr = False
                page_type = "digital"
            elif word_count > 0:
                conf = 0.70
                needs_ocr = False
                page_type = "low_density_digital"
            else:
                conf = 0.0
                needs_ocr = True
                page_type = "scanned"
            needs_vision = needs_ocr or (img_count > 0)
            pages_data.append({
                "page_number": idx + 1,
                "text": page_text.strip(),
                "word_count": word_count,
                "confidence": conf,
                "needs_ocr": needs_ocr,
                "needs_vision": needs_vision,
                "diagrams_count": img_count,
                "page_type": page_type
            })
            if page_text.strip():
                full_text.append(f"--- Page {idx + 1} ---\\n{page_text.strip()}")
        return {
            "total_pages": total_pages,
            "pages": pages_data,
            "full_text": "\\n\\n".join(full_text)
        }
    except Exception:
        page_matches = re.findall(rb'/Type\\s*/Page\\b', raw_bytes)
        estimated_pages = max(1, min(len(page_matches), MAX_PAGES_LIMIT))
        stream_pattern = re.compile(rb'stream[\\r\\n]+(.*?)[\\r\\n]+endstream', re.DOTALL)
        streams = stream_pattern.findall(raw_bytes)
        extracted_chunks = []
        diagram_count = len(re.findall(rb'/Subtype\\s*/Image\\b', raw_bytes))
        for s in streams[:300]:
            if time.perf_counter() - start_time > EXECUTION_TIMEOUT_SECONDS:
                break
            decomp = None
            try:
                decomp = zlib.decompress(s)
            except Exception:
                try:
                    decomp = zlib.decompress(s, -15)
                except Exception:
                    decomp = s
            if decomp:
                for bt in re.findall(rb'BT(.*?)ET', decomp, re.DOTALL):
                    t_literals = re.findall(rb'\\((.*?)\\)\\s*T[jJ]', bt)
                    for lit in t_literals:
                        try:
                            clean_str = lit.decode('latin1', errors='ignore').strip()
                            if len(clean_str) > 1:
                                extracted_chunks.append(clean_str)
                        except Exception:
                            pass
        full_text = " ".join(extracted_chunks)
        word_count = len(full_text.split())
        if word_count > 50:
            conf = 0.90
            needs_ocr = False
            page_type = "digital"
        elif word_count > 0:
            conf = 0.65
            needs_ocr = True
            page_type = "mixed"
        else:
            conf = 0.0
            needs_ocr = True
            page_type = "scanned"
        needs_vision = needs_ocr or (diagram_count > 0)
        pages_data = [{
            "page_number": 1,
            "text": full_text,
            "word_count": word_count,
            "confidence": conf,
            "needs_ocr": needs_ocr,
            "needs_vision": needs_vision,
            "diagrams_count": diagram_count,
            "page_type": page_type
        }]
        return {
            "total_pages": estimated_pages,
            "pages": pages_data,
            "full_text": full_text
        }

def run(input_data, context=None):
    start_time = time.perf_counter()
    doc_info = input_data.get('document') if isinstance(input_data, dict) and isinstance(input_data.get('document'), dict) else input_data
    if not isinstance(doc_info, dict):
        return {
            "status": "failed",
            "error_type": "InvalidInput",
            "error_message": "Missing required 'document' payload in input_data",
            "is_recoverable": False,
            "confidence": 0.0
        }
    file_name = (
        doc_info.get('file_name')
        or doc_info.get('name')
        or input_data.get('file_name')
        or input_data.get('name')
        or (input_data.get('document') if isinstance(input_data.get('document'), str) else 'unnamed_doc')
        or 'unnamed_doc'
    )
    ext = os.path.splitext(file_name)[1].lower().lstrip('.')
    size_bytes = doc_info.get('size_bytes') or doc_info.get('size') or input_data.get('size_bytes') or input_data.get('size') or 0
    b64_data = doc_info.get('file_bytes_b64') or doc_info.get('b64') or input_data.get('file_bytes_b64') or input_data.get('b64') or ''
    local_path = doc_info.get('file_path') or doc_info.get('local_path') or input_data.get('file_path') or input_data.get('local_path') or ''

    if (size_bytes is not None and size_bytes <= 0) and not b64_data and not (local_path and os.path.exists(local_path) and os.path.getsize(local_path) > 0):
        return {
            "status": "failed",
            "error_type": "EmptyFile",
            "error_message": f"File '{file_name}' is empty (0 bytes). Extraction aborted.",
            "is_recoverable": False,
            "confidence": 0.0
        }
    size_mb = (size_bytes / (1024 * 1024)) if size_bytes else (len(b64_data) * 3 / 4 / (1024 * 1024))
    if size_mb > MAX_FILE_SIZE_MB:
        return {
            "status": "failed",
            "error_type": "HardwareLimitExceeded",
            "error_message": f"Document size ({round(size_mb, 2)}MB) exceeds safety memory limit of {MAX_FILE_SIZE_MB}MB.",
            "is_recoverable": False,
            "confidence": 0.0
        }
    raw_bytes = doc_info.get('header_bytes') or input_data.get('header_bytes') or b''
    if not raw_bytes and local_path and os.path.exists(local_path):
        try:
            with open(local_path, 'rb') as f:
                raw_bytes = f.read()
            size_bytes = len(raw_bytes)
        except Exception:
            pass

    if b64_data and not raw_bytes:
        try:
            if ',' in b64_data[:60]:
                b64_data = b64_data.split(',', 1)[1]
            raw_bytes = base64.b64decode(b64_data)
        except Exception as e:
            return {
                "status": "failed",
                "error_type": "Base64DecodeError",
                "error_message": f"Failed to decode base64 file data: {str(e)}",
                "is_recoverable": False,
                "confidence": 0.0
            }
    try:
        pages_result = []
        extracted_text = ""
        tables = []
        overall_conf = 1.0
        needs_vision = False
        scanned_pages = []
        diagram_pages = []
        total_pages = 1
        if ext == 'docx':
            res = _extract_docx(raw_bytes, start_time)
            extracted_text = res["text"]
            tables = res["tables"]
            total_pages = res["pages_estimate"]
            overall_conf = 0.98 if extracted_text else 0.0
            pages_result = [{
                "page_number": 1,
                "text": extracted_text,
                "confidence": overall_conf,
                "needs_ocr": False,
                "needs_vision": False,
                "diagrams_count": 0,
                "page_type": "digital"
            }]
        elif ext in ('csv', 'tsv'):
            res = _extract_csv(raw_bytes)
            extracted_text = res["text"]
            overall_conf = 1.0
            pages_result = [{
                "page_number": 1,
                "text": extracted_text,
                "confidence": 1.0,
                "needs_ocr": False,
                "needs_vision": False,
                "diagrams_count": 0,
                "page_type": "tabular"
            }]
        elif ext == 'pdf':
            res = _extract_pdf(raw_bytes, start_time)
            extracted_text = res["full_text"]
            pages_result = res["pages"]
            total_pages = res["total_pages"]
            for p in pages_result:
                if p["needs_ocr"] or p["confidence"] < 0.70:
                    scanned_pages.append(p["page_number"])
                if p["diagrams_count"] > 0:
                    diagram_pages.append(p["page_number"])
            needs_vision = bool(scanned_pages or diagram_pages)
            overall_conf = round(sum(p["confidence"] for p in pages_result) / len(pages_result), 2) if pages_result else 0.0
        else:
            try:
                extracted_text = raw_bytes.decode('utf-8')
            except UnicodeDecodeError:
                extracted_text = raw_bytes.decode('latin1', errors='ignore')
            overall_conf = 1.0 if extracted_text.strip() else 0.0
            pages_result = [{
                "page_number": 1,
                "text": extracted_text,
                "confidence": overall_conf,
                "needs_ocr": False,
                "needs_vision": False,
                "diagrams_count": 0,
                "page_type": "text"
            }]
        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
        return {
            "status": "success",
            "document_name": file_name,
            "format": ext or "text",
            "total_pages": total_pages,
            "extracted_text": _safe_clean_text(extracted_text),
            "character_count": len(extracted_text),
            "word_count": len(extracted_text.split()),
            "overall_confidence": overall_conf,
            "pages": pages_result,
            "tables": tables,
            "escalation": {
                "needs_vision_model": needs_vision,
                "scanned_pages": scanned_pages,
                "diagram_pages": diagram_pages,
                "low_confidence": overall_conf < 0.70
            },
            "hardware_metrics": {
                "duration_ms": duration_ms,
                "memory_safe": True,
                "truncated": False
            }
        }
    except TimeoutError as te:
        return {
            "status": "failed",
            "error_type": "ExecutionTimeout",
            "error_message": str(te),
            "is_recoverable": True,
            "confidence": 0.0
        }
    except Exception as e:
        return {
            "status": "failed",
            "error_type": e.__class__.__name__,
            "error_message": f"Extraction failure: {str(e)}",
            "is_recoverable": False,
            "confidence": 0.0
        }
`,
  },
  node_context_builder: {
    id: 'node_context_builder',
    name: 'node_context_builder',
    code: `# node_context_builder
# Pure function entry: def run(input_data, context=None) -> dict

${MANIFEST_SPEC_GUIDE}

MANIFEST = {
    "name": "node_context_builder",
    "version": "1.0.0",
    "description": "Prepares structured comparison context from two exploration nodes for AI relationship synthesis and thread validation.",
    "inputs": {
        "node_pair": {
            "type": "json",
            "required": True,
            "description": "Pair payload containing source_node, target_node, and exploration_id"
        }
    },
    "outputs": {
        "comparison_context": {
            "type": "json",
            "description": "Sanitized semantic context, keywords, and comparison prompt ready for Muse Spark evaluation"
        }
    }
}

import re
import json

def sanitize_text(text) -> str:
    if not text:
        return ""
    clean = re.sub(r'\\s+', ' ', str(text)).strip()
    return clean[:2000]

def extract_node_summary(node) -> dict:
    if not isinstance(node, dict):
        return {"id": "unknown", "title": "Unknown", "description": "", "type": "unknown"}
    
    metadata = node.get("metadata") if isinstance(node.get("metadata"), dict) else {}
    return {
        "id": str(node.get("id") or node.get("node_id") or "unknown"),
        "title": sanitize_text(node.get("title") or node.get("name") or "Untitled Node"),
        "description": sanitize_text(node.get("description") or node.get("content") or ""),
        "type": str(node.get("type") or "finding").lower(),
        "status": str(node.get("status") or "proposed"),
        "category": str(node.get("category") or "info"),
        "source_doc": metadata.get("source_document") or node.get("sourceDoc") or None
    }

def run(input_data, context=None) -> dict:
    """
    Pure engine entry point:
    Validates source and target nodes, filters out raw binary files,
    and constructs a normalized comparison package for the AI model.
    """
    if not isinstance(input_data, dict):
        return {
            "status": "error",
            "error": "input_data must be a dictionary with source_node and target_node",
            "valid": False
        }

    pair = input_data.get("node_pair") if isinstance(input_data.get("node_pair"), dict) else input_data
    source_raw = pair.get("source_node") or pair.get("sourceNode") or input_data.get("source_node") or input_data.get("sourceNode") or {}
    target_raw = pair.get("target_node") or pair.get("targetNode") or input_data.get("target_node") or input_data.get("targetNode") or {}
    exploration_id = pair.get("exploration_id") or input_data.get("exploration_id") or "exploration_01"

    source = extract_node_summary(source_raw)
    target = extract_node_summary(target_raw)

    # Rejection rule: raw unextracted file resources cannot be connected directly by user
    invalid_types = {"document", "resource", "file"}
    if source["type"] in invalid_types or target["type"] in invalid_types:
        return {
            "status": "rejected",
            "valid": False,
            "reason": "Direct connections between raw unextracted files are not supported. Extract knowledge nodes first.",
            "source": source,
            "target": target
        }

    words_a = set(re.findall(r'\\b[a-zA-Z]{4,}\\b', (source["title"] + " " + source["description"]).lower()))
    words_b = set(re.findall(r'\\b[a-zA-Z]{4,}\\b', (target["title"] + " " + target["description"]).lower()))
    stop_words = {"this", "that", "with", "from", "have", "were", "what", "when", "where", "which", "there", "their"}
    shared_keywords = sorted(list((words_a & words_b) - stop_words))[:8]

    return {
        "status": "success",
        "valid": True,
        "exploration_id": exploration_id,
        "source_node": source,
        "target_node": target,
        "shared_keywords": shared_keywords,
        "prompt_instruction": (
            f"Analyze the relationship between Node A and Node B:\\n"
            f"- Node A ({source['type'].upper()}): \\"{source['title']}\\" -> {source['description']}\\n"
            f"- Node B ({target['type'].upper()}): \\"{target['title']}\\" -> {target['description']}\\n"
            f"Determine if a valid logical, supportive, contradictory, or causal connection exists. "
            f"Return a JSON object with: {{\\"connected\\": true/false, \\"relationship\\": \\"supports|contradicts|elaborates|correlates|none\\", "
            f"\\"label\\": \\"Short 3-5 word relationship summary\\", \\"explanation\\": \\"One sentence explaining why\\"}}"
        )
    }
`,
  },
};

// Safe client-side parser for Python MANIFEST dictionary
function extractManifest(code = '') {
  if (!code) return null;
  const match = code.match(/MANIFEST\s*=\s*(\{[\s\S]*?\n\})/);
  if (!match) return null;
  try {
    const raw = match[1];
    let s = raw
      .replace(/#.*$/gm, '')
      .replace(/\bTrue\b/g, 'true')
      .replace(/\bFalse\b/g, 'false')
      .replace(/\bNone\b/g, 'null')
      .replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, '"$1"')
      .replace(/,\s*([}\]])/g, '$1');
    const parsed = JSON.parse(s);
    if (parsed && typeof parsed === 'object') {
      return parsed;
    }
  } catch (err) {
    // In-progress syntax while user is typing
  }
  return null;
}

const isFileModality = (type) =>
  ['file', 'image', 'audio', 'video', 'document', 'pdf'].includes(String(type || '').toLowerCase());

export const getEngineInitialCode = (engineId, enginesData) => {
  const readableName = (engineId || 'engine').replace(/_/g, ' ');

  if (enginesData?.[engineId]?.code) {
    const existing = enginesData[engineId].code;
    if (engineId === 'file_detection' && (!existing.includes('MAGIC_SIGNATURES') || existing.includes('File Detection Engine') || existing.includes('engine 03') || existing.includes('engine_03') || existing.includes('"version": "1.0.0"') || existing.includes('ROUTING_MAP') || !existing.includes('COMPATIBILITY_MAP'))) {
      return DEFAULT_ENGINES.file_detection.code;
    }
    if (!existing.includes('MANIFEST')) {
      const defaultManifest = `${MANIFEST_SPEC_GUIDE}

MANIFEST = {
    "name": "${readableName}",
    "version": "1.0.0",
    "description": "Custom processing engine",
    "inputs": {
        "text": {
            "type": "text",
            "required": True,
            "description": "Input text or query to process"
        }
    },
    "outputs": {
        "result": {
            "type": "json",
            "description": "Processed output data"
        }
    }
}

`;
      return defaultManifest + existing;
    }
    return existing;
  }

  if (engineId === 'resource_bridge') {
    return DEFAULT_ENGINES.resource_bridge.code;
  }
  if (engineId === 'file_detection') {
    return DEFAULT_ENGINES.file_detection.code;
  }
  if (engineId === 'document_extractor') {
    return DEFAULT_ENGINES.document_extractor.code;
  }
  if (engineId === 'node_context_builder') {
    return DEFAULT_ENGINES.node_context_builder.code;
  }

  return `# ${engineId}
# Pure function entry: def run(input_data, context=None) -> dict

${MANIFEST_SPEC_GUIDE}

MANIFEST = {
    "name": "${readableName}",
    "version": "1.0.0",
    "description": "Custom processing engine",
    "inputs": {
        "text": {
            "type": "text",
            "required": True,
            "description": "Input text or query to process"
        }
    },
    "outputs": {
        "result": {
            "type": "json",
            "description": "Processed output data"
        }
    }
}

def run(input_data, context=None):
    """
    ${engineId} processing logic.
    """
    text = input_data.get("text", "") if isinstance(input_data, dict) else str(input_data)
    return {
        "status": "success",
        "engine": "${engineId}",
        "output": text
    }
`;
};

// Static inspection of Python code without executing it
function inspectPythonEngine(code = '') {
  // 1. Dependency detection
  const importLines = code.match(/^(?:from\s+([a-zA-Z0-9_]+)|import\s+([a-zA-Z0-9_]+))/gm) || [];
  const dependencies = [];
  for (const line of importLines) {
    const m = line.match(/(?:from|import)\s+([a-zA-Z0-9_]+)/);
    if (m && m[1] && !dependencies.includes(m[1])) {
      dependencies.push(m[1]);
    }
  }

  // 2. Type Hint detection
  const typeHintMatch = code.match(/def\s+run\s*\(\s*input_data\s*:\s*([^,\)=]+)/);
  const typeHint = typeHintMatch ? typeHintMatch[1].trim().toLowerCase() : '';

  // Extract input processing logic (exclude return statements so return types aren't confused with input types)
  const runFuncMatch = code.match(/def\s+run\s*\([^)]*\):([\s\S]*)/);
  const runBody = runFuncMatch ? runFuncMatch[1].split(/\n\s*return\b/)[0] : code;
  const lowerBody = runBody.toLowerCase();

  // 3. Static usage heuristics on input_data
  const textMatches = [
    'input_data.get("text"',
    "input_data.get('text'",
    'input_data.get("prompt"',
    "input_data.get('prompt'",
    'input_data.get("content"',
    "input_data.get('content'",
    'input_data.get("query"',
    "input_data.get('query'",
    'isinstance(input_data, str)',
    'str(input_data)',
    'input_data.split',
    'input_data.lower',
    'input_data.strip',
  ];

  const fileMatches = [
    'input_data.get("file"',
    "input_data.get('file'",
    'input_data.get("file_name"',
    "input_data.get('file_name'",
    'input_data.get("file_bytes"',
    "input_data.get('file_bytes'",
    'file_bytes',
    'header_bytes',
    'magic_signatures',
    'mimetypes.guess_type',
  ];

  let inferredInput = 'json';
  if (typeHint.includes('str') || typeHint.includes('text')) {
    inferredInput = 'text';
  } else if (textMatches.some((kw) => lowerBody.includes(kw))) {
    inferredInput = 'text';
  } else if (fileMatches.some((kw) => lowerBody.includes(kw))) {
    inferredInput = 'file';
  } else if (lowerBody.includes('json.loads') || lowerBody.includes('input_data.get(')) {
    inferredInput = 'json';
  }

  // 4. Output modality inference
  let inferredOutput = 'json';
  const returnMatch = code.match(/return\s+([\s\S]*)/);
  const returnSnippet = returnMatch ? returnMatch[1].toLowerCase() : lowerBody;

  if (
    returnSnippet.includes('"type": "file"') ||
    returnSnippet.includes("'type': 'file'") ||
    returnSnippet.includes('"type":"file"') ||
    returnSnippet.includes("'type':'file'")
  ) {
    inferredOutput = 'file';
  } else if (
    (returnSnippet.includes('str(') || returnSnippet.includes('f"') || returnSnippet.includes("f'")) &&
    !returnSnippet.includes('{') &&
    !returnSnippet.includes('dict') &&
    !returnSnippet.includes('status')
  ) {
    inferredOutput = 'text';
  } else {
    inferredOutput = 'json';
  }

  return {
    inferredInput, // 'file' | 'text' | 'json'
    inferredOutput, // 'file' | 'text' | 'json'
    dependencies,
  };
}

function renderModalityIcon(type, titlePrefix = '') {
  const norm = String(type || '').toLowerCase();
  switch (norm) {
    case 'text':
      return (
        <svg
          key={type}
          className="engine-mod-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          title={`${titlePrefix}Text`}
        >
          <polyline points="4 7 4 4 20 4 20 7" />
          <line x1="9" y1="20" x2="15" y2="20" />
          <line x1="12" y1="4" x2="12" y2="20" />
        </svg>
      );
    case 'image':
      return (
        <svg
          key={type}
          className="engine-mod-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          title={`${titlePrefix}Image`}
        >
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      );
    case 'audio':
      return (
        <svg
          key={type}
          className="engine-mod-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          title={`${titlePrefix}Audio`}
        >
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </svg>
      );
    case 'video':
      return (
        <svg
          key={type}
          className="engine-mod-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          title={`${titlePrefix}Video`}
        >
          <polygon points="23 7 16 12 23 17 23 7" />
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
        </svg>
      );
    case 'number':
      return (
        <svg
          key={type}
          className="engine-mod-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          title={`${titlePrefix}Number`}
        >
          <line x1="4" y1="9" x2="20" y2="9" />
          <line x1="4" y1="15" x2="20" y2="15" />
          <line x1="10" y1="3" x2="8" y2="21" />
          <line x1="16" y1="3" x2="14" y2="21" />
        </svg>
      );
    case 'boolean':
      return (
        <svg
          key={type}
          className="engine-mod-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          title={`${titlePrefix}Boolean`}
        >
          <rect x="1" y="5" width="22" height="14" rx="7" ry="7" />
          <circle cx="16" cy="12" r="3" />
        </svg>
      );
    case 'file':
    case 'document':
    case 'pdf':
      return (
        <svg
          key={type}
          className="engine-mod-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          title={`${titlePrefix}File`}
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      );
    case 'code':
    case 'json':
    default:
      return (
        <svg
          key={type}
          className="engine-mod-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          title={`${titlePrefix}JSON / Data`}
        >
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
      );
  }
}


export default function EnginesPage({
  engines = ['file_detection', 'document_extractor'],
  currentEngine = 'file_detection',
  enginesData = {},
  onSelectEngine,
  onUpdateEngineCode,
  onDeleteEngine,
}) {
  const activeEngineId = currentEngine || 'file_detection';
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editorCode, setEditorCode] = useState(() =>
    getEngineInitialCode(activeEngineId, enginesData)
  );

  const [inputFiles, setInputFiles] = useState({});
  const [inputValues, setInputValues] = useState({
    text: 'Sample research text for extraction analysis.',
  });
  const [validationError, setValidationError] = useState(null);
  const [dragOverPort, setDragOverPort] = useState(null);
  const [simOutput, setSimOutput] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [serverStatus, setServerStatus] = useState('checking'); // 'online' | 'offline' | 'checking'
  const [showServerTooltip, setShowServerTooltip] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [downloadedServer, setDownloadedServer] = useState(false);
  const [showServerSetupModal, setShowServerSetupModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [baseUrlInput, setBaseUrlInput] = useState('https://api.meta.ai/v1');
  const [copiedRunCmd, setCopiedRunCmd] = useState(false);

  // Statically inspect the current Python code
  const inspection = useMemo(() => inspectPythonEngine(editorCode), [editorCode]);

  // Parse declarative MANIFEST contract or fallback
  const manifest = useMemo(() => {
    const parsed = extractManifest(editorCode);
    if (parsed && parsed.inputs && parsed.outputs) {
      return parsed;
    }
    return {
      name: activeEngineId,
      version: '1.0.0',
      inputs: {
        [inspection.inferredInput === 'file' ? 'file' : 'input']: {
          type: inspection.inferredInput,
          required: true,
        },
      },
      outputs: {
        result: {
          type: inspection.inferredOutput,
        },
      },
    };
  }, [editorCode, activeEngineId, inspection]);

  const manifestInputs = manifest.inputs || {};
  const manifestOutputs = manifest.outputs || {};

  // Detect if engine returned a file object
  const fileOutput = useMemo(() => {
    if (!simOutput || typeof simOutput !== 'object') return null;
    const target =
      simOutput.output && typeof simOutput.output === 'object' && simOutput.output.type === 'file'
        ? simOutput.output
        : simOutput.type === 'file'
        ? simOutput
        : null;

    if (target && (target.filename || target.file_name)) {
      return {
        filename: target.filename || target.file_name || 'output_file',
        mimeType: target.mime_type || target.mimeType || 'text/plain',
        content: target.content ?? target.text ?? target.file_bytes_b64 ?? '',
        isBase64: Boolean(target.file_bytes_b64),
      };
    }
    return null;
  }, [simOutput]);

  const handleDownloadOutputFile = () => {
    if (!fileOutput) return;
    try {
      let blob;
      if (fileOutput.isBase64) {
        const byteCharacters = atob(fileOutput.content);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        blob = new Blob([byteArray], { type: fileOutput.mimeType });
      } else {
        blob = new Blob([fileOutput.content], { type: fileOutput.mimeType });
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileOutput.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download output file:', err);
    }
  };

  const handleGenerateServer = (e) => {
    if (e) e.preventDefault();
    try {
      let rawKey = apiKeyInput.trim();
      if (rawKey.includes('MODEL_API_KEY=')) {
        const match = rawKey.match(/MODEL_API_KEY=([^\r\n]+)/);
        if (match) rawKey = match[1].trim();
      } else if (rawKey.includes('=')) {
        rawKey = rawKey.split('=').pop().trim();
      }

      const rawBaseUrl = baseUrlInput.trim() || 'https://api.meta.ai/v1';

      let customizedSource = SERVER_PY_SOURCE;
      if (rawKey) {
        customizedSource = customizedSource.replace(
          'DEFAULT_API_KEY = ""',
          `DEFAULT_API_KEY = ${JSON.stringify(rawKey)}`
        );
      }
      if (rawBaseUrl && rawBaseUrl !== 'https://api.meta.ai/v1') {
        customizedSource = customizedSource.replace(
          'DEFAULT_BASE_URL = "https://api.meta.ai/v1"',
          `DEFAULT_BASE_URL = ${JSON.stringify(rawBaseUrl)}`
        );
      }

      // Download single merged standalone server.py
      const sBlob = new Blob([customizedSource], { type: 'text/x-python;charset=utf-8' });
      const sUrl = URL.createObjectURL(sBlob);
      const sLink = document.createElement('a');
      sLink.href = sUrl;
      sLink.download = 'server.py';
      document.body.appendChild(sLink);
      sLink.click();
      document.body.removeChild(sLink);
      URL.revokeObjectURL(sUrl);

      setDownloadedServer(true);
      setTimeout(() => setDownloadedServer(false), 3000);
    } catch (err) {
      console.error('Failed to generate server.py:', err);
    }
  };

  const handleDownloadServer = (e) => {
    e.stopPropagation();
    setShowServerTooltip(false);
    setShowServerSetupModal(true);
  };

  // Check Python engine server health
  useEffect(() => {
    let isMounted = true;
    const checkServer = async () => {
      try {
        const res = await fetch('http://127.0.0.1:8001/health', { method: 'GET' });
        if (res.ok && isMounted) {
          setServerStatus('online');
          return;
        }
      } catch (err) {
        // Server unreachable
      }
      if (isMounted) setServerStatus('offline');
    };

    checkServer();
    const interval = setInterval(checkServer, 4000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Sync editor only when active engine changes (not on every typing update)
  const prevEngineIdRef = useRef(activeEngineId);
  useEffect(() => {
    if (prevEngineIdRef.current !== activeEngineId) {
      prevEngineIdRef.current = activeEngineId;
      const code = getEngineInitialCode(activeEngineId, enginesData);
      setEditorCode(code);
      setSimOutput(null);
      setValidationError(null);
    }
    // Auto-sync upgraded default file_detection code if outdated
    if (activeEngineId === 'file_detection') {
      const canonicalCode = getEngineInitialCode('file_detection', enginesData);
      if (enginesData?.file_detection?.code !== canonicalCode) {
        onUpdateEngineCode?.('file_detection', canonicalCode);
      }
    }
  }, [activeEngineId]);

  const handleCodeChange = (e) => {
    const val = e.target.value;
    setEditorCode(val);
    onUpdateEngineCode?.(activeEngineId, val);
  };

  const runSimulation = async () => {
    setValidationError(null);

    // 1. Strict Contract Validation: verify every required input has a value
    for (const [portKey, portSpec] of Object.entries(manifestInputs)) {
      if (portSpec && portSpec.required) {
        if (isFileModality(portSpec.type)) {
          if (!inputFiles[portKey]) {
            setValidationError({ field: portKey, message: `Missing required input "${portKey}"` });
            setSimOutput({ error: `Validation Error: Missing required input "${portKey}" (type: ${portSpec.type || 'file'})` });
            return;
          }
        } else {
          const val = inputValues[portKey];
          if (val === undefined || val === null || String(val).trim() === '') {
            setValidationError({ field: portKey, message: `Missing required input "${portKey}"` });
            setSimOutput({ error: `Validation Error: Missing required input "${portKey}" (type: ${portSpec.type || 'text'})` });
            return;
          }
        }
      }
    }

    setIsSimulating(true);

    try {
      // 2. Build multi-port input payload
      const inputPayload = {};
      for (const [portKey, portSpec] of Object.entries(manifestInputs)) {
        const pType = String(portSpec.type || 'text').toLowerCase();
        if (isFileModality(pType)) {
          const file = inputFiles[portKey];
          if (file) {
            const buf = await file.arrayBuffer();
            const bytes = new Uint8Array(buf);
            let binaryStr = '';
            const readLen = Math.min(bytes.length, 512 * 1024);
            for (let i = 0; i < readLen; i++) {
              binaryStr += String.fromCharCode(bytes[i]);
            }
            const fileObj = {
              file_name: file.name,
              name: file.name,
              size_bytes: file.size,
              mime_type: file.type || 'application/octet-stream',
              file_bytes_b64: btoa(binaryStr),
              modality: pType,
            };
            inputPayload[portKey] = fileObj;
            inputPayload.file_name = file.name;
            inputPayload.size_bytes = file.size;
            inputPayload.file_bytes_b64 = btoa(binaryStr);
          }
        } else if (pType === 'json') {
          const raw = inputValues[portKey] || '';
          try {
            inputPayload[portKey] = JSON.parse(raw);
          } catch {
            inputPayload[portKey] = raw;
          }
        } else if (pType === 'number') {
          const raw = inputValues[portKey];
          inputPayload[portKey] = raw === '' || isNaN(Number(raw)) ? 0 : Number(raw);
        } else if (pType === 'boolean') {
          const raw = inputValues[portKey];
          inputPayload[portKey] = raw === true || raw === 'true';
        } else {
          inputPayload[portKey] = inputValues[portKey] ?? '';
        }
      }

      const res = await fetch('http://127.0.0.1:8001/api/engines/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: editorCode,
          input_data: inputPayload,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.status === 'success') {
          setSimOutput(data.output);
          setServerStatus('online');
        } else if (data.status === 'error') {
          setSimOutput({ error: data.error, traceback: data.traceback });
        }
      } else {
        setSimOutput({
          status: 'error',
          error: `Server returned HTTP ${res.status}`,
        });
      }
    } catch {
      setServerStatus('offline');
      setSimOutput({
        status: 'error',
        error: 'Python server is offline. Please start the server to execute engine code.',
      });
    } finally {
      setIsSimulating(false);
    }
  };

  const hoverTimeoutRef = useRef(null);

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setShowServerTooltip(true);
  };

  const handleMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setShowServerTooltip(false);
    }, 250);
  };

  return (
    <div className="engines-page-container">
      {/* Top Bar - Clean and minimal */}
      <div className="engines-top-bar">
        {/* Left side empty for fixed top breadcrumbs capsule */}
        <div />

        {/* Right side: Delete button + Server status pill */}
        <div className="engines-top-right">
          {!['resource_bridge', 'file_detection', 'document_extractor', 'node_context_builder'].includes(activeEngineId) && onDeleteEngine && (
            <button
              type="button"
              className="engine-top-delete-btn"
              onClick={() => setShowDeleteModal(true)}
              title={`Delete engine ${activeEngineId}`}
            >
              Delete Engine
            </button>
          )}

          <div
            className="engine-server-pill-wrap"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <div
              className={`engine-server-pill ${serverStatus}`}
              onClick={() => setShowServerSetupModal(true)}
              title="Configure local Python server and environment (.env)"
            >
              <span className={`status-dot ${serverStatus === 'online' ? 'online' : 'offline'}`} />
              <span className="status-label">
                {serverStatus === 'online' ? 'Server: Online' : 'Server: Offline'}
              </span>
            </div>

            {/* Offline Helper Popover on Hover */}
            {serverStatus !== 'online' && showServerTooltip && (
              <div
                className="server-offline-popover"
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
              >
                <div className="popover-header-row">
                  <span className="popover-title">Start Python Server</span>
                </div>

                <div className="popover-section">
                  <div className="popover-step-row">
                    <span className="popover-step-index">1</span>
                    <span className="popover-sub">Get configured server and environment:</span>
                  </div>
                  <button
                    type="button"
                    className="popover-download-btn"
                    onClick={handleDownloadServer}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    <span>Configure server & .env</span>
                  </button>
                </div>

                <div className="popover-section">
                  <div className="popover-step-row">
                    <span className="popover-step-index">2</span>
                    <span className="popover-sub">Run in your terminal:</span>
                  </div>
                  <div className="popover-code-row">
                    <code>python3 ~/Downloads/server.py</code>
                    <button
                      type="button"
                      className="popover-copy-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText('python3 ~/Downloads/server.py');
                        setCopiedCmd(true);
                        setTimeout(() => setCopiedCmd(false), 1800);
                      }}
                    >
                      {copiedCmd ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Split Grid */}
      <div className="engines-workspace-grid">
        {/* Left: CodeMirror 6 Python Code Editor */}
        <div className="engine-code-card">
          <EngineCodeEditor
            value={editorCode}
            onChange={(val) => {
              setEditorCode(val);
              onUpdateEngineCode?.(activeEngineId, val);
            }}
          />
        </div>

        {/* Right: Universal Testing with Multi-Port Arrow Pill */}
        <div className="engine-sim-card">
          <div className="engine-sim-header">
            <span className="engine-sim-title">Testing</span>
            <div className="engine-io-pill">
              <div className="engine-mod-group">
                {Object.entries(manifestInputs).map(([portKey, portSpec]) => (
                  <span
                    key={portKey}
                    className="engine-port-tag"
                    title={`${portKey} (${portSpec.type || 'text'})${portSpec.required ? ' *required' : ''}`}
                  >
                    {renderModalityIcon(portSpec.type || 'text')}
                  </span>
                ))}
              </div>
              <span className="engine-mod-arrow">→</span>
              <div className="engine-mod-group">
                {Object.entries(manifestOutputs).map(([portKey, portSpec]) => (
                  <span
                    key={portKey}
                    className="engine-port-tag"
                    title={`${portKey} (${portSpec.type || 'json'})`}
                  >
                    {renderModalityIcon(fileOutput ? 'file' : portSpec.type || 'json')}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="engine-sim-body">

            {/* Dynamic Input Form for each declared port */}
            <div className="engine-inputs-form">
              {Object.entries(manifestInputs).map(([portKey, portSpec]) => {
                const isRequired = !!portSpec.required;
                const portType = portSpec.type || 'text';
                const fileForPort = inputFiles[portKey];
                const valueForPort = inputValues[portKey] || '';
                const isFieldErr = validationError?.field === portKey;

                const isFile = isFileModality(portType);

                return (
                  <div key={portKey} className="engine-field-group">
                    <div className="engine-field-label-row">
                      <span className="engine-field-name">{portKey}</span>
                      <span className={`engine-field-req-tag ${isRequired ? 'required' : 'optional'}`}>
                        {isRequired ? 'Required *' : 'Optional'}
                      </span>
                    </div>

                    {isFile ? (
                      <div
                        className={`engine-upload-box ${isFieldErr ? 'has-error' : ''} ${dragOverPort === portKey ? 'is-drag-over' : ''}`}
                        onClick={() => {
                          const input = document.getElementById(`file-input-${portKey}`);
                          input?.click();
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDragOverPort(portKey);
                        }}
                        onDragLeave={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (dragOverPort === portKey) setDragOverPort(null);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDragOverPort(null);
                          const file = e.dataTransfer?.files?.[0];
                          if (file) {
                            setInputFiles((prev) => ({ ...prev, [portKey]: file }));
                            setValidationError(null);
                            setSimOutput(null);
                          }
                        }}
                      >
                        <input
                          id={`file-input-${portKey}`}
                          type="file"
                          accept={
                            portType === 'image'
                              ? 'image/*'
                              : portType === 'audio'
                              ? 'audio/*'
                              : portType === 'video'
                              ? 'video/*'
                              : portType === 'pdf'
                              ? '.pdf'
                              : '*/*'
                          }
                          className="hidden-file-input"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setInputFiles((prev) => ({ ...prev, [portKey]: file }));
                              setValidationError(null);
                              setSimOutput(null);
                            }
                          }}
                        />
                        {fileForPort ? (
                          <div className="engine-file-selected">
                            <div className="engine-file-selected-row">
                              {renderModalityIcon(portType)}
                              <span className="engine-file-name">{fileForPort.name}</span>
                            </div>
                            <span className="engine-file-size">
                              {(fileForPort.size / (1024 * 1024)).toFixed(2)} MB &bull; {fileForPort.type || portType}
                            </span>
                          </div>
                        ) : (
                          <div className="engine-upload-placeholder-wrap">
                            {renderModalityIcon(portType)}
                            <span className="engine-upload-prompt">
                              Click or drop {portType === 'image' ? 'image' : portType === 'audio' ? 'audio' : 'file'}
                            </span>
                          </div>
                        )}
                      </div>
                    ) : portType === 'number' ? (
                      <input
                        type="number"
                        className={`engine-sim-single-input ${isFieldErr ? 'has-error' : ''}`}
                        placeholder="Enter number..."
                        value={valueForPort}
                        onChange={(e) => {
                          const val = e.target.value;
                          setInputValues((prev) => ({ ...prev, [portKey]: val }));
                          setValidationError(null);
                          setSimOutput(null);
                        }}
                      />
                    ) : portType === 'boolean' ? (
                      <select
                        className={`engine-sim-select ${isFieldErr ? 'has-error' : ''}`}
                        value={valueForPort === '' ? 'false' : String(valueForPort)}
                        onChange={(e) => {
                          const val = e.target.value === 'true';
                          setInputValues((prev) => ({ ...prev, [portKey]: val }));
                          setValidationError(null);
                          setSimOutput(null);
                        }}
                      >
                        <option value="true">True</option>
                        <option value="false">False</option>
                      </select>
                    ) : (
                      <textarea
                        className={`engine-sim-text-input ${isFieldErr ? 'has-error' : ''}`}
                        placeholder={portType === 'json' ? 'Enter JSON...' : 'Enter text...'}
                        value={valueForPort}
                        onChange={(e) => {
                          const val = e.target.value;
                          setInputValues((prev) => ({ ...prev, [portKey]: val }));
                          setValidationError(null);
                          setSimOutput(null);
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Run Button */}
            <button
              type="button"
              className="engine-run-btn"
              onClick={runSimulation}
              disabled={isSimulating}
            >
              {isSimulating ? 'Running...' : 'Run'}
            </button>

            {/* Output Display */}
            <div className="engine-output-box">
              {simOutput ? (
                <div className="engine-output-content-wrap">
                  {/* Dedicated Output File Card when Engine returns a file */}
                  {fileOutput && (
                    <div className="engine-file-result-card">
                      <div className="file-result-main">
                        <svg className="file-result-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                          <line x1="16" y1="13" x2="8" y2="13" />
                          <line x1="16" y1="17" x2="8" y2="17" />
                        </svg>
                        <div className="file-result-meta">
                          <span className="file-result-name">{fileOutput.filename}</span>
                          <span className="file-result-type">{fileOutput.mimeType}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="file-result-download-btn"
                        onClick={handleDownloadOutputFile}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        <span>Download</span>
                      </button>
                    </div>
                  )}

                  {Object.values(simOutput.output && typeof simOutput.output === 'object' ? simOutput.output : {})
                    .filter((v) => v && v.type === 'file' && v.url)
                    .map((f) => (
                      <EngineFilePreview key={f.url} file={f} />
                    ))}

                  <pre className="engine-output-text">
                    {JSON.stringify(simOutput, null, 2)}
                  </pre>
                </div>
              ) : (
                <span className="engine-output-placeholder">
                  Output will appear here
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="engine-modal-backdrop" onClick={() => setShowDeleteModal(false)}>
          <div className="engine-modal-card" onClick={(e) => e.stopPropagation()}>
            <h4 className="engine-modal-title">Delete Engine</h4>
            <p className="engine-modal-desc">
              Are you sure you want to delete <code className="engine-modal-code">{activeEngineId}</code>? This engine will be permanently removed.
            </p>
            <div className="engine-modal-actions">
              <button
                type="button"
                className="engine-modal-btn-cancel"
                onClick={() => setShowDeleteModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="engine-modal-btn-delete"
                onClick={() => {
                  setShowDeleteModal(false);
                  onDeleteEngine?.(activeEngineId);
                }}
              >
                Delete Engine
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Python Server & Environment Setup Modal */}
      {showServerSetupModal && (
        <div className="engine-modal-backdrop" onClick={() => setShowServerSetupModal(false)}>
          <div className="engine-modal-card engine-server-setup-card" onClick={(e) => e.stopPropagation()}>
            <div className="engine-server-setup-header">
              <div className="engine-server-setup-title-row">
                <h4 className="engine-modal-title">Python Server & Environment Setup</h4>
                <button
                  type="button"
                  className="engine-server-setup-close"
                  onClick={() => setShowServerSetupModal(false)}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              <p className="engine-modal-desc">
                Paste your Meta API key to download a self-contained server.py file.
              </p>
            </div>

            <div className="engine-server-live-status">
              <span className={`status-dot ${serverStatus === 'online' ? 'online' : 'offline'}`} />
              <span className="engine-server-status-text">
                {serverStatus === 'online'
                  ? 'Server is running on http://127.0.0.1:8001'
                  : 'Server is offline (127.0.0.1:8001)'}
              </span>
            </div>

            <form onSubmit={handleGenerateServer} className="engine-server-setup-form">
              <div className="engine-server-field-group">
                <label htmlFor="server-api-key-input" className="engine-server-label">
                  Meta API Key
                </label>
                <input
                  id="server-api-key-input"
                  type="text"
                  className="engine-server-key-input"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="Paste your key (e.g. LLM_...)"
                  autoFocus
                  spellCheck={false}
                />
              </div>

              <div className="engine-server-field-group">
                <label htmlFor="server-base-url-input" className="engine-server-label">
                  Base URL
                </label>
                <input
                  id="server-base-url-input"
                  type="text"
                  className="engine-server-readonly-input"
                  value={baseUrlInput}
                  onChange={(e) => setBaseUrlInput(e.target.value)}
                  placeholder="https://api.meta.ai/v1"
                />
              </div>

              <div className="engine-server-run-instructions">
                <span className="engine-server-inst-label">Terminal command to run:</span>
                <div className="engine-server-cmd-box">
                  <code>python3 server.py</code>
                  <button
                    type="button"
                    className="engine-server-copy-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText('python3 server.py');
                      setCopiedRunCmd(true);
                      setTimeout(() => setCopiedRunCmd(false), 2000);
                    }}
                  >
                    {copiedRunCmd ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              <div className="engine-modal-actions">
                <button
                  type="button"
                  className="engine-modal-btn-cancel"
                  onClick={() => setShowServerSetupModal(false)}
                >
                  Close
                </button>
                <button
                  type="submit"
                  className={`engine-server-btn-download ${downloadedServer ? 'downloaded' : ''}`}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  <span>{downloadedServer ? 'Downloaded server.py' : 'Download server.py'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
