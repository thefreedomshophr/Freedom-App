import React from "react";

export default function PrintReceipt({ orderBuilds, saleID, employeeCode, logoUrl, placementDisplayNames }) {
  return (
    <>
      <style>{`
        #receipt-content {
          position: absolute;
          left: -9999px;
          top: 0;
        }
        @media print {
          body * { visibility: hidden; }
          #receipt-content, #receipt-content * { visibility: visible; }
          #receipt-content {
            position: absolute; left: 0; top: 0;
            width: 72mm; margin: 0; padding: 5mm;
            font-family: 'Courier New', monospace;
            font-size: 11pt; line-height: 1.4; color: #000; font-weight: bold;
          }
          .receipt-header { text-align: center; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 2px dashed #000; }
          .receipt-title { font-size: 18pt; font-weight: bold; margin-bottom: 4px; }
          .receipt-detail { margin: 3px 0; font-weight: bold; font-size: 13pt; }
          .receipt-prints { margin-left: 8px; margin-top: 4px; }
          .receipt-barcode { text-align: center; margin: 8px 0; }
          .receipt-barcode img { max-width: 100%; height: auto; }
          .receipt-barcode-label { font-size: 13pt; margin-top: 2px; font-weight: bold; }
          .receipt-footer { text-align: center; margin-top: 15px; padding-top: 8px; border-top: 2px dashed #000; font-weight: bold; }
          .no-print { display: none !important; }
          @page { size: 72mm auto; margin: 0; }
          .receipt-item { margin-bottom: 15px; padding-bottom: 8px; border-bottom: 1px dashed #000; }
          .receipt-item-header { font-weight: bold; font-size: 14pt; margin-bottom: 4px; }
        }
      `}</style>

      <div id="receipt-content">
        <div className="receipt-header">
          {logoUrl && (
            <div style={{ textAlign: 'center', marginBottom: '8px' }}>
              <img src={logoUrl} alt="Store Logo" style={{ maxWidth: '90%', height: 'auto', margin: '0 auto' }} />
            </div>
          )}
          <div className="receipt-title">FREEDOM APPAREL</div>
          <div style={{ fontSize: '14pt', fontWeight: 'bold', marginTop: '4px' }}>
            Employee: {employeeCode || 'N/A'}
          </div>
        </div>

        {saleID && (
          <div style={{ textAlign: 'center', marginTop: '15px' }}>
            <div style={{ fontSize: '18pt', fontWeight: 'bold', marginBottom: '8px' }}>Sale ID: {saleID}</div>
            <div className="receipt-barcode">
              <img
                src={`https://bwipjs-api.metafloor.com/?bcid=code128&text=${encodeURIComponent(saleID)}&scale=4&includetext`}
                alt={`Barcode ${saleID}`}
              />
            </div>
          </div>
        )}

        <div style={{ marginTop: '20px' }}>
          {orderBuilds.map((build, idx) => (
            <div key={idx} className="receipt-item">
              <div className="receipt-item-header">
                {build.isScannedItem ? build.description : `${build.size} ${build.color} ${build.garment?.style}`}
              </div>
              {build.prints?.map((print, pIdx) => (
                <div key={pIdx} className="receipt-prints">
                  <div style={{ fontWeight: 'bold', fontSize: '12pt' }}>{print.name}</div>
                  <div style={{ fontSize: '11pt', marginLeft: '4px' }}>
                    Placement: {placementDisplayNames[print.placement] || print.placement}
                  </div>
                  {print.notes && print.notes.trim() && (
                    <div style={{ fontSize: '11pt', marginLeft: '4px', fontWeight: 'bold' }}>{print.notes}</div>
                  )}
                </div>
              ))}
              {build.wax_protection && (
                <div className="receipt-prints">
                  <div style={{ fontWeight: 'bold', fontSize: '11pt' }}>
                    Wax Protection - ${build.wax_protection.price.toFixed(2)}
                  </div>
                  {build.wax_protection.discountAmount > 0 && (
                    <div style={{ fontSize: '11pt', marginLeft: '4px' }}>
                      Wax Discount - -${build.wax_protection.discountAmount.toFixed(2)}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="receipt-footer">
          <div style={{ marginTop: '10px' }}>Thank You!</div>
        </div>
      </div>
    </>
  );
}