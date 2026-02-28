import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Upload, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";


export default function AdminStyleThumbnails() {
  const navigate = useNavigate();
  const [styles, setStyles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(null);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    try {
      const user = await base44.auth.me();
      if (user.role !== 'admin') {
        navigate(createPageUrl("Home"));
        return;
      }
      await loadStyles();
    } catch (error) {
      navigate(createPageUrl("Home"));
    }
  };

  const loadStyles = async () => {
    try {
      const garments = await base44.entities.Garment.list();
      const icons = await base44.entities.CustomIcon.list();
      
      // Group by style
      const styleMap = new Map();
      garments.forEach(garment => {
        if (garment.style && !styleMap.has(garment.style)) {
          styleMap.set(garment.style, {
            style: garment.style,
            thumbnail: null
          });
        }
      });
      
      // Match icons to styles
      icons.forEach(icon => {
        if (icon.identifier.startsWith('style_thumbnail_')) {
          const styleName = icon.identifier.replace('style_thumbnail_', '');
          if (styleMap.has(styleName)) {
            styleMap.get(styleName).thumbnail = icon.icon_url;
          }
        }
      });
      
      const uniqueStyles = Array.from(styleMap.values());
      setStyles(uniqueStyles);
    } catch (error) {
      console.error('Error loading styles:', error);
      setMessage({ type: 'error', text: 'Failed to load styles' });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (styleData, event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(styleData.style);
    setMessage(null);

    try {
      // Upload the new image
      const uploadResult = await base44.integrations.Core.UploadFile({ file });
      const newImageUrl = uploadResult.file_url;

      const identifier = `style_thumbnail_${styleData.style}`;
      
      // Check if icon already exists
      const existingIcons = await base44.entities.CustomIcon.filter({ identifier });
      
      if (existingIcons.length > 0) {
        // Update existing icon
        await base44.entities.CustomIcon.update(existingIcons[0].id, {
          icon_url: newImageUrl
        });
      } else {
        // Create new icon
        await base44.entities.CustomIcon.create({
          identifier,
          page_name: 'StyleSelection',
          description: `Thumbnail for ${styleData.style}`,
          icon_url: newImageUrl
        });
      }

      setMessage({ type: 'success', text: `Updated thumbnail for ${styleData.style}` });
      await loadStyles();
    } catch (error) {
      console.error('Error uploading thumbnail:', error);
      setMessage({ type: 'error', text: 'Failed to upload thumbnail' });
    } finally {
      setUploading(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-foreground"></div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] p-6 md:p-12">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate(createPageUrl("AdminDashboard"))}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Button>
        </div>

        <h1 className="text-4xl font-light mb-2">
          Style Thumbnails
        </h1>
        <p className="text-muted-foreground mb-8">
          Manage thumbnail images that appear in style selection
        </p>

        {message && (
          <Alert className={`mb-6 ${message.type === 'error' ? 'border-red-500' : 'border-green-500'}`}>
            <AlertDescription className={message.type === 'error' ? 'text-red-500' : 'text-green-500'}>
              {message.text}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {styles.map((styleData) => (
            <Card key={styleData.style} className="border-0 shadow-lg">
              <CardContent className="p-6">
                <div className="aspect-square bg-muted rounded-lg mb-4 flex items-center justify-center overflow-hidden">
                  {styleData.thumbnail ? (
                    <img
                      src={styleData.thumbnail}
                      alt={styleData.style}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-4xl text-muted-foreground">👕</div>
                  )}
                </div>

                <h3 className="text-lg font-light mb-4 text-center">
                  {styleData.style}
                </h3>

                <div className="relative">
                  <Input
                    type="file"
                    accept=".jpg,.jpeg,image/jpeg"
                    onChange={(e) => handleFileUpload(styleData, e)}
                    disabled={uploading === styleData.style}
                    className="hidden"
                    id={`file-${styleData.style}`}
                  />
                  <Button
                    onClick={() => document.getElementById(`file-${styleData.style}`).click()}
                    disabled={uploading === styleData.style}
                    className="w-full gap-2 bg-blue-600 hover:bg-blue-700"
                  >
                    {uploading === styleData.style ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        Upload New Thumbnail
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}