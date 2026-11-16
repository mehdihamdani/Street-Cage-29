import * as THREE from 'three';

export function createTurfTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const width = 1024;
  const height = 1664;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Base artificial turf green with subtle alternating mowed bands
  const bands = 14;
  const bandH = height / bands;
  for (let i = 0; i < bands; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#1b6b3a' : '#1f7842';
    ctx.fillRect(0, i * bandH, width, bandH + 1);
  }

  // Subtle turf crumb/grass micro-grain
  for (let i = 0; i < 18000; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const bright = Math.random() > 0.5;
    ctx.fillStyle = bright ? 'rgba(110, 220, 145, 0.06)' : 'rgba(6, 26, 14, 0.08)';
    ctx.fillRect(x, y, 2, 2);
  }

  // Subtle high-traffic wear near penalty spots & center
  const addWear = (cx: number, cy: number, r: number) => {
    const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, r);
    g.addColorStop(0, 'rgba(30, 52, 32, 0.25)');
    g.addColorStop(1, 'rgba(30, 52, 32, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  };
  addWear(width / 2, 185, 85);
  addWear(width / 2, height - 185, 85);
  addWear(width / 2, height / 2, 70);

  // Crisp white chalk pitch markings
  const marginX = 48;
  const marginY = 48;
  const pw = width - marginX * 2;
  const ph = height - marginY * 2;

  ctx.strokeStyle = 'rgba(244, 248, 245, 0.92)';
  ctx.lineWidth = 8;
  ctx.lineJoin = 'round';

  // Outer boundary
  ctx.strokeRect(marginX, marginY, pw, ph);

  // Halfway line
  ctx.beginPath();
  ctx.moveTo(marginX, height / 2);
  ctx.lineTo(width - marginX, height / 2);
  ctx.stroke();

  // Center circle & spot
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, 130, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(244, 248, 245, 0.95)';
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, 11, 0, Math.PI * 2);
  ctx.fill();

  // North penalty area
  const boxW = 460;
  const boxH = 220;
  ctx.strokeRect((width - boxW) / 2, marginY, boxW, boxH);
  const sixW = 240;
  const sixH = 88;
  ctx.strokeRect((width - sixW) / 2, marginY, sixW, sixH);
  ctx.beginPath();
  ctx.arc(width / 2, marginY + 155, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(width / 2, marginY + 155, 95, 0.22 * Math.PI, 0.78 * Math.PI);
  ctx.stroke();

  // South penalty area
  ctx.strokeRect((width - boxW) / 2, height - marginY - boxH, boxW, boxH);
  ctx.strokeRect((width - sixW) / 2, height - marginY - sixH, sixW, sixH);
  ctx.beginPath();
  ctx.arc(width / 2, height - marginY - 155, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(width / 2, height - marginY - 155, 95, 1.22 * Math.PI, 1.78 * Math.PI);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  return texture;
}

export function createBallTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#f5f6f7';
  ctx.fillRect(0, 0, size, size);

  // Draw crisp Telstar-inspired street football panels
  ctx.strokeStyle = '#1f2937';
  ctx.lineWidth = 4;

  const cols = 6;
  const rows = 4;
  const cellW = size / cols;
  const cellH = size / rows;

  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      const cx = c * cellW + (r % 2 === 0 ? 0 : cellW * 0.5);
      const cy = r * cellH;
      ctx.fillStyle = (r + c) % 2 === 0 ? '#111827' : '#f59e0b';
      ctx.beginPath();
      const rad = 28;
      for (let i = 0; i < 5; i++) {
        const angle = (i * Math.PI * 2) / 5 - Math.PI / 2;
        const px = cx + Math.cos(angle) * rad;
        const py = cy + Math.sin(angle) * rad;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  return texture;
}

export function createJerseyTexture(
  primaryColor: string,
  stripeColor: string,
  numberText: string,
  maxAnisotropy: number,
  striped = false,
): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = primaryColor;
  ctx.fillRect(0, 0, size, size);

  if (striped) {
    ctx.fillStyle = stripeColor;
    const stripeCount = 6;
    const sw = size / (stripeCount * 2);
    for (let i = 0; i < stripeCount; i++) {
      ctx.fillRect(i * sw * 2, 0, sw, size);
    }
  } else {
    // Diagonal street sash
    ctx.fillStyle = stripeColor;
    ctx.beginPath();
    ctx.moveTo(0, size * 0.2);
    ctx.lineTo(size, size * 0.55);
    ctx.lineTo(size, size * 0.72);
    ctx.lineTo(0, size * 0.37);
    ctx.closePath();
    ctx.fill();
  }

  // Crisp jersey number on back & chest
  ctx.fillStyle = striped ? '#f59e0b' : '#ffffff';
  ctx.strokeStyle = '#090d16';
  ctx.lineWidth = 7;
  ctx.font = '900 94px "Chakra Petch", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeText(numberText, size * 0.5, size * 0.52);
  ctx.fillText(numberText, size * 0.5, size * 0.52);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  return texture;
}

export function createBannerTexture(
  title: string,
  subtitle: string,
  bgColor: string,
  accentColor: string,
  maxAnisotropy: number,
): THREE.CanvasTexture {
  const width = 512;
  const height = 128;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = accentColor;
  ctx.fillRect(0, 0, 18, height);
  ctx.fillRect(width - 18, 0, 18, height);

  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, width - 8, height - 8);

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 44px "Chakra Petch", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, width / 2, height * 0.44);

  ctx.fillStyle = accentColor;
  ctx.font = '700 20px "Chakra Petch", sans-serif';
  ctx.fillText(subtitle, width / 2, height * 0.77);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  return texture;
}

export function createBuildingFacadeTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const width = 256;
  const height = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#111622';
  ctx.fillRect(0, 0, width, height);

  // Subtle brick horizontal bands
  ctx.fillStyle = 'rgba(255,255,255,0.025)';
  for (let y = 0; y < height; y += 16) {
    ctx.fillRect(0, y, width, 2);
  }

  // Apartment windows (mix of warm lit, cool TV glow, and dark)
  const cols = 4;
  const rows = 9;
  const padX = 18;
  const padY = 22;
  const winW = (width - padX * (cols + 1)) / cols;
  const winH = 28;
  const stepY = (height - 40) / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const wx = padX + c * (winW + padX);
      const wy = padY + r * stepY;
      const roll = Math.random();
      if (roll < 0.28) {
        ctx.fillStyle = '#fbbf24';
      } else if (roll < 0.42) {
        ctx.fillStyle = '#7dd3fc';
      } else {
        ctx.fillStyle = '#090d16';
      }
      ctx.fillRect(wx, wy, winW, winH);
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 2;
      ctx.strokeRect(wx, wy, winW, winH);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  return texture;
}

export function createRadialShadowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    4,
    size / 2,
    size / 2,
    size / 2,
  );
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
  grad.addColorStop(0.6, 'rgba(0, 0, 0, 0.22)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
