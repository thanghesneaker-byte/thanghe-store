'use client';

import { useEffect, useState } from 'react';

export default function ProductGallery({
  images,
  name,
}: {
  images: string[];
  name: string;
}) {
  const unique = [...new Set(images.filter(Boolean))];
  const [selected, setSelected] = useState(0);

  useEffect(() => setSelected(0), [images.join('|')]);

  if (unique.length === 0) {
    return (
      <div style={{
        background: '#e6eef3', display: 'grid',
        placeItems: 'center', width: '100%', minHeight: 250,
        color: '#60788b',
      }}>
        Chưa có ảnh sản phẩm
      </div>
    );
  }

  const index = Math.min(selected, unique.length - 1);

  return (
    <div style={{ width: '100%', minWidth: 0 }}>
      <img
        src={unique[index]}
        alt={name + ' - ảnh ' + (index + 1)}
        style={{
          width: '100%', height: 'auto', maxHeight: 450,
          aspectRatio: '1', objectFit: 'contain',
          background: '#f1f5f9', display: 'block',
        }}
      />
      {unique.length > 1 && (
        <div
          aria-label={'Bộ ảnh ' + name}
          style={{
            display: 'flex', gap: 8, marginTop: 10,
            flexWrap: 'wrap', alignItems: 'center',
          }}
        >
          {unique.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => setSelected(i)}
              aria-label={'Xem ảnh ' + (i + 1) + ' của ' + name}
              aria-pressed={index === i}
              style={{
                border: index === i ? '2px solid #0d9488' : '1px solid #cbd5e1',
                background: 'white', padding: 2, borderRadius: 8,
                cursor: 'pointer',
              }}
            >
              <img
                src={src}
                alt=""
                style={{
                  width: 60, height: 60,
                  objectFit: 'cover', display: 'block', borderRadius: 5,
                }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
