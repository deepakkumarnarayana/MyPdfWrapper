#!/usr/bin/env python3
"""
PDF Image Analysis Tool
Analyzes PDF files to identify image formats, compression, and compatibility issues
"""

import os
import sys
import fitz  # PyMuPDF
from pathlib import Path
import json

def analyze_pdf_images(pdf_path):
    """Analyze images in a PDF file"""
    if not os.path.exists(pdf_path):
        print(f"❌ Error: PDF file not found: {pdf_path}")
        return None
    
    try:
        doc = fitz.open(pdf_path)
        analysis = {
            "pdf_info": {
                "file_path": pdf_path,
                "file_size": os.path.getsize(pdf_path),
                "pages": doc.page_count,
                "metadata": doc.metadata
            },
            "images": [],
            "summary": {
                "total_images": 0,
                "image_formats": {},
                "compression_types": {},
                "potential_issues": []
            }
        }
        
        print(f"📄 Analyzing PDF: {pdf_path}")
        print(f"📊 Pages: {doc.page_count}")
        print(f"💾 Size: {os.path.getsize(pdf_path) / 1024 / 1024:.2f} MB")
        
        # Analyze each page
        for page_num in range(doc.page_count):
            page = doc[page_num]
            image_list = page.get_images()
            
            print(f"\n📑 Page {page_num + 1}:")
            print(f"   Images found: {len(image_list)}")
            
            for img_index, img in enumerate(image_list):
                try:
                    # Extract image details
                    xref = img[0]  # xref number
                    pix = fitz.Pixmap(doc, xref)
                    
                    # Get image metadata
                    img_dict = doc.extract_image(xref)
                    
                    image_info = {
                        "page": page_num + 1,
                        "index": img_index,
                        "xref": xref,
                        "width": pix.width if pix else None,
                        "height": pix.height if pix else None,
                        "colorspace": pix.colorspace.name if pix and pix.colorspace else "Unknown",
                        "bpc": pix.bpc if pix else None,  # bits per component
                        "ext": img_dict.get("ext", "unknown"),
                        "size": len(img_dict.get("image", b"")),
                        "cs-name": img_dict.get("cs-name", "unknown"),
                        "smask": img[1],  # soft mask
                        "alpha": pix.alpha if pix else False
                    }
                    
                    analysis["images"].append(image_info)
                    analysis["summary"]["total_images"] += 1
                    
                    # Track formats
                    ext = image_info["ext"]
                    analysis["summary"]["image_formats"][ext] = analysis["summary"]["image_formats"].get(ext, 0) + 1
                    
                    # Track colorspace
                    cs_name = image_info["cs-name"]
                    analysis["summary"]["compression_types"][cs_name] = analysis["summary"]["compression_types"].get(cs_name, 0) + 1
                    
                    print(f"   🖼️ Image {img_index + 1}:")
                    print(f"      Format: {ext} ({cs_name})")
                    print(f"      Size: {image_info['width']}x{image_info['height']}")
                    print(f"      Colorspace: {image_info['colorspace']}")
                    print(f"      Data size: {image_info['size']} bytes")
                    print(f"      Bits per component: {image_info['bpc']}")
                    print(f"      Has alpha: {image_info['alpha']}")
                    
                    # Check for potential PDF.js compatibility issues
                    if ext == "jp2" or cs_name == "JPXDecode":
                        analysis["summary"]["potential_issues"].append(f"JPEG2000 image on page {page_num + 1} - requires OpenJPEG WASM decoder")
                    
                    if ext == "jb2" or cs_name == "JBIG2Decode":
                        analysis["summary"]["potential_issues"].append(f"JBIG2 image on page {page_num + 1} - requires JBIG2 WASM decoder")
                    
                    if image_info['bpc'] and image_info['bpc'] > 8:
                        analysis["summary"]["potential_issues"].append(f"High bit depth image ({image_info['bpc']} bpc) on page {page_num + 1} - may cause rendering issues")
                    
                    if pix:
                        pix = None  # Free memory
                        
                except Exception as e:
                    print(f"   ❌ Error processing image {img_index}: {e}")
                    analysis["summary"]["potential_issues"].append(f"Error processing image on page {page_num + 1}: {str(e)}")
        
        doc.close()
        
        # Print summary
        print(f"\n📊 ANALYSIS SUMMARY:")
        print(f"   Total images: {analysis['summary']['total_images']}")
        print(f"   Image formats: {dict(analysis['summary']['image_formats'])}")
        print(f"   Compression types: {dict(analysis['summary']['compression_types'])}")
        
        if analysis['summary']['potential_issues']:
            print(f"\n⚠️ POTENTIAL PDF.js COMPATIBILITY ISSUES:")
            for issue in analysis['summary']['potential_issues']:
                print(f"   • {issue}")
        else:
            print(f"\n✅ No obvious PDF.js compatibility issues detected")
        
        # PDF.js specific recommendations
        print(f"\n🔧 PDF.js CONFIGURATION RECOMMENDATIONS:")
        
        has_jpeg2000 = any(fmt in ["jp2", "jpx"] for fmt in analysis['summary']['image_formats'].keys())
        has_jbig2 = any(fmt == "jb2" for fmt in analysis['summary']['image_formats'].keys())
        has_jpeg2000_compression = any("JPX" in comp for comp in analysis['summary']['compression_types'].keys())
        has_jbig2_compression = any("JBIG2" in comp for comp in analysis['summary']['compression_types'].keys())
        
        if has_jpeg2000 or has_jpeg2000_compression:
            print("   📦 Ensure OpenJPEG WASM decoder is loaded: /pdfjs-full/wasm/openjpeg.wasm")
            print("   🔧 Check PDF.js worker configuration includes JPEG2000 support")
        
        if has_jbig2 or has_jbig2_compression:
            print("   📦 Ensure JBIG2 WASM decoder is loaded: /pdfjs-full/wasm/jbig2.wasm")
            print("   🔧 Check PDF.js worker configuration includes JBIG2 support")
        
        if not (has_jpeg2000 or has_jbig2 or has_jpeg2000_compression or has_jbig2_compression):
            print("   ✅ Standard image formats detected - basic PDF.js should handle these")
            print("   🔍 Issue likely in PDF.js configuration, CORS, or worker setup")
        
        return analysis
        
    except Exception as e:
        print(f"❌ Error analyzing PDF: {e}")
        return None

def main():
    if len(sys.argv) != 2:
        print("Usage: python pdf_image_analyzer.py <pdf_file_path>")
        print("Example: python pdf_image_analyzer.py storage/pdfs/sample.pdf")
        return
    
    pdf_path = sys.argv[1]
    
    # Check if PyMuPDF is installed
    try:
        import fitz
    except ImportError:
        print("❌ PyMuPDF not installed. Install with: pip install PyMuPDF")
        return
    
    analysis = analyze_pdf_images(pdf_path)
    
    if analysis:
        # Save analysis to JSON file
        output_path = pdf_path.replace('.pdf', '_image_analysis.json')
        with open(output_path, 'w') as f:
            json.dump(analysis, f, indent=2)
        print(f"\n💾 Detailed analysis saved to: {output_path}")

if __name__ == "__main__":
    main()