import React, { useState, useEffect } from "react";

// Simple cache to avoid re-fetching the same SVG
const svgCache = {};

export default function SvgImage({ src, alt, className, fallback }) {
  const [svgContent, setSvgContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!src) {
      setLoading(false);
      return;
    }

    // Check cache first
    if (svgCache[src]) {
      setSvgContent(svgCache[src]);
      setLoading(false);
      return;
    }

    const loadSvg = async () => {
      try {
        const response = await fetch(src);
        if (!response.ok) {
          console.warn(`Failed to load SVG from ${src}: ${response.status}`);
          setError(true);
          setLoading(false);
          return;
        }
        const text = await response.text();
        
        // Parse the SVG
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(text, 'image/svg+xml');
        const svgElement = svgDoc.querySelector('svg');
        
        if (!svgElement) {
          svgCache[src] = text;
          setSvgContent(text);
          setLoading(false);
          return;
        }

        // Normalize SVG sizing
        let viewBox = svgElement.getAttribute('viewBox');
        if (!viewBox) {
          const width = svgElement.getAttribute('width') || '100';
          const height = svgElement.getAttribute('height') || '100';
          viewBox = `0 0 ${width} ${height}`;
        }
        
        svgElement.setAttribute('viewBox', viewBox);
        svgElement.setAttribute('width', '100%');
        svgElement.setAttribute('height', '100%');
        svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        
        // Add inline border-radius
        svgElement.setAttribute('style', `border-radius: 0.75rem; ${svgElement.getAttribute('style') || ''}`);

        // HIDE ALL PRINT-AREA RECTANGLES
        const printAreaElements = svgElement.querySelectorAll('[id="print-area"]');
        printAreaElements.forEach(element => {
          element.setAttribute('opacity', '0');
          element.setAttribute('visibility', 'hidden');
          element.setAttribute('display', 'none');
          element.setAttribute('fill', 'none');
          element.setAttribute('stroke', 'none');
        });
        
        const printAreaRect = svgElement.querySelector('#print-area');
        if (printAreaRect) {
          printAreaRect.setAttribute('opacity', '0');
          printAreaRect.setAttribute('visibility', 'hidden');
          printAreaRect.setAttribute('display', 'none');
          printAreaRect.setAttribute('fill', 'none');
          printAreaRect.setAttribute('stroke', 'none');
        }

        const serializer = new XMLSerializer();
        const modifiedSvg = serializer.serializeToString(svgElement);
        svgCache[src] = modifiedSvg;
        setSvgContent(modifiedSvg);
        
      } catch (err) {
        console.warn('Failed to load SVG:', src, err.message);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    loadSvg();
  }, [src]);

  if (loading) {
    return <div className={className}>{fallback || '...'}</div>;
  }

  if (error || !svgContent) {
    return <div className={className}>{fallback}</div>;
  }

  return (
    <div 
      className={`${className} overflow-hidden`}
      style={{ borderRadius: '0.75rem' }}
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  );
}