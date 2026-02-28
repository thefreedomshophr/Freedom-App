import React from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export default function CsvTemplateDownload({ type }) {
  const downloadTemplate = () => {
    let csvContent = "";
    
    if (type === "prints") {
      csvContent = "name,description,cost,system_id,categories,availability,width,height,print_size,garment_type,active,tops_placements,bottoms_placements,image,itemID,primary_matches,secondary_matches\n";
      csvContent += "Sample Print,A beautiful design,25.00,210000012345,Sports|Kids,\"FR, SH, CB\",12,14,Adult,tops,1,Front Center|Front Left Chest,Left Thigh|Back Waist,sample-print.jpg,788,\"210000012346, 210000012347\",\"210000012348, 210000012349\"";
    } else if (type === "garments") {
      csvContent = "Name,System ID,Sale Price,Size,Color,Style,Front Max Print Width,Front Max Print Height,Back Max Print Width,Back Max Print Height,Rsleeve Max Print Width,Rsleeve Max Print Height,Lsleeve Max Print Width,Lsleeve Max Print Height,Front Image,Back Image,Rsleeve Image,Lsleeve Image,Availability,itemID\n";
      csvContent += "Sample T-Shirt,67890,15.00,M,Red,Adult T-Shirt,12,14,12,14,3,4,3,4,front.svg,back.svg,rsleeve.svg,lsleeve.svg,\"FR, SH, CB\",789";
    } else if (type === "merchandise") {
      csvContent = "Name,System ID,Price,Item ID\n";
      csvContent += "Sample Merchandise,210000012345,15.00,789";
    }

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${type}_template.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Button onClick={downloadTemplate} variant="outline" className="gap-2">
      <Download className="w-4 h-4" />
      Download CSV Template
    </Button>
  );
}