import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { syncPosCustomers } from "@/functions/syncPosCustomers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Search, RefreshCw, Trash2, Upload } from "lucide-react";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export default function AdminCustomerInfo() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [syncStatus, setSyncStatus] = useState(null);
  const [syncProgress, setSyncProgress] = useState(null);
  const [nextUrl, setNextUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 100;

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    if (searchTerm.trim() === "") {
      setFilteredCustomers(customers);
    } else {
      const term = searchTerm.toLowerCase();
      const filtered = customers.filter(customer => 
        customer.name?.toLowerCase().includes(term) ||
        customer.home?.toLowerCase().includes(term) ||
        customer.work?.toLowerCase().includes(term) ||
        customer.mobile?.toLowerCase().includes(term) ||
        customer.email?.toLowerCase().includes(term)
      );
      setFilteredCustomers(filtered);
    }
    setCurrentPage(1); // Reset to first page when search changes
  }, [searchTerm, customers]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentCustomers = filteredCustomers.slice(startIndex, endIndex);

  const loadCustomers = async () => {
    try {
      const limit = 5000;
      let skip = 0;
      let allCustomers = [];
      
      while (true) {
        const batch = await base44.entities.CustomerInformation.list('-created_date', limit, skip);
        allCustomers = allCustomers.concat(batch);
        
        if (batch.length < limit) {
          break;
        }
        
        skip += limit;
      }
      
      setCustomers(allCustomers);
      setFilteredCustomers(allCustomers);
    } catch (error) {
      console.error('Error loading customers:', error);
    }
    setLoading(false);
  };

  const syncCustomersFromPos = async () => {
    setSyncing(true);
    setSyncStatus(null);
    setSyncProgress('Downloading customers from POS...');
    
    try {
      const selectedLocationData = localStorage.getItem('selectedLocation');
      if (!selectedLocationData) {
        setSyncStatus({
          type: 'error',
          message: 'No location selected'
        });
        setSyncing(false);
        setSyncProgress(null);
        return;
      }
      
      const selectedLocation = JSON.parse(selectedLocationData);
      
      // Call backend function to get CSV
      const response = await base44.functions.invoke('exportPosCustomers', { 
        locationId: selectedLocation.id
      });
      
      // Create blob and download
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lightspeed-customers-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

      setSyncStatus({
        type: 'success',
        message: 'Successfully downloaded customers CSV'
      });
    } catch (error) {
      console.error('Error downloading customers:', error);
      setSyncStatus({
        type: 'error',
        message: error.message || 'Failed to download customers from POS'
      });
    } finally {
      setSyncing(false);
      setSyncProgress(null);
    }
  };

  const handleDelete = async (customerId) => {
    try {
      await base44.entities.CustomerInformation.delete(customerId);
      
      // Update local state
      const updatedCustomers = customers.filter(c => c.id !== customerId);
      setCustomers(updatedCustomers);
      setFilteredCustomers(updatedCustomers.filter(customer => {
        const term = searchTerm.toLowerCase();
        return searchTerm.trim() === "" || 
               customer.name?.toLowerCase().includes(term) ||
               customer.home?.toLowerCase().includes(term) ||
               customer.work?.toLowerCase().includes(term) ||
               customer.mobile?.toLowerCase().includes(term) ||
               customer.email?.toLowerCase().includes(term);
      }));
    } catch (error) {
      console.error('Error deleting customer:', error);
      alert('Failed to delete customer. Please try again.');
    }
  };

  const handleCsvUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.name.endsWith('.csv')) {
      setUploadStatus({ type: 'error', message: 'Please upload a CSV file' });
      setTimeout(() => setUploadStatus(null), 5000);
      return;
    }

    setUploading(true);
    setUploadStatus(null);

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      let imported = 0;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        if (i % 100 === 0) {
          setUploadStatus({
            type: 'info',
            message: `Importing... ${imported} of ${lines.length}`
          });
        }
        
        const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        
        await base44.entities.CustomerInformation.create({
          name: values[0] || `Record ${i + 1}`,
          home: values[1] || '',
          work: values[2] || '',
          mobile: values[3] || '',
          email: values[4] || '',
          customerID: values[5] || ''
        });
        imported++;
        
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      setUploadStatus({
        type: 'success',
        message: `Imported ${imported} customers`
      });
      
      await loadCustomers();
      
    } catch (error) {
      setUploadStatus({
        type: 'error',
        message: 'Failed to read CSV file'
      });
    } finally {
      setUploading(false);
      e.target.value = '';
      setTimeout(() => setUploadStatus(null), 10000);
    }
  };

  const handlePdfUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || file.type !== 'application/pdf') {
      setUploadStatus({ type: 'error', message: 'Please upload a PDF file' });
      setTimeout(() => setUploadStatus(null), 5000);
      return;
    }

    setUploading(true);
    setUploadStatus(null);

    try {
      // Upload the PDF
      const uploadResult = await base44.integrations.Core.UploadFile({ file });
      const fileUrl = uploadResult.file_url;

      // Define the schema for customer data extraction
      const jsonSchema = {
        type: "object",
        properties: {
          customers: {
            type: "array",
            items: {
              type: "object",
              properties: {
                firstName: { type: "string" },
                lastName: { type: "string" },
                home: { type: "string" },
                work: { type: "string" },
                mobile: { type: "string" },
                email: { type: "string" }
              }
            }
          }
        }
      };

      // Extract data from PDF
      const extractResult = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url: fileUrl,
        json_schema: jsonSchema
      });

      if (extractResult.status === 'error') {
        throw new Error(extractResult.details || 'Failed to extract data from PDF');
      }

      const extractedCustomers = extractResult.output?.customers || [];
      
      // Process and save customers
      let created = 0;
      for (const customer of extractedCustomers) {
        // Skip if firstName is blank or "Unnamed Record"
        if (!customer.firstName || customer.firstName.trim() === '' || customer.firstName.toLowerCase().includes('unnamed')) {
          continue;
        }

        // Clean up fields
        const cleanField = (value) => {
          if (!value || value.trim() === '' || value.toLowerCase().includes('unnamed')) {
            return '';
          }
          return value.trim();
        };

        const firstName = cleanField(customer.firstName);
        const lastName = cleanField(customer.lastName);
        const home = cleanField(customer.home);
        const work = cleanField(customer.work);
        const mobile = cleanField(customer.mobile);
        const email = cleanField(customer.email);

        // Skip if no phone number at all
        if (!home && !work && !mobile) continue;

        // Create customer record
        await base44.entities.CustomerInformation.create({
          name: `${firstName} ${lastName}`.trim(),
          home: home,
          work: work,
          mobile: mobile,
          email: email
        });
        
        created++;
      }

      setUploadStatus({
        type: 'success',
        message: `Successfully imported ${created} customers from PDF`
      });
      
      await loadCustomers();
      
    } catch (error) {
      console.error('Error processing PDF:', error);
      setUploadStatus({
        type: 'error',
        message: error.message || 'Failed to process PDF'
      });
    } finally {
      setUploading(false);
      e.target.value = ''; // Reset file input
      setTimeout(() => setUploadStatus(null), 10000);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] p-6 md:p-12">
      <div className="max-w-7xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate(createPageUrl("AdminDashboard"))}
          className="mb-4 gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6">
            <div>
              <h1 className="text-4xl font-light text-gray-900 mb-2">
                Customer Information
              </h1>
              <p className="text-gray-600 font-light">
                View customer contact information from POS
              </p>
            </div>
            
            <div className="flex gap-2">
              <Button
                onClick={syncCustomersFromPos}
                disabled={syncing}
                className="gap-2 bg-blue-600 hover:bg-blue-700"
              >
                <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Downloading...' : 'Download from POS'}
              </Button>
              
              <Button
                onClick={() => document.getElementById('csv-upload').click()}
                disabled={uploading}
                className="gap-2 bg-purple-600 hover:bg-purple-700"
              >
                <Upload className={`w-4 h-4 ${uploading ? 'animate-pulse' : ''}`} />
                {uploading ? 'Uploading...' : 'Upload CSV'}
              </Button>
              <input
                id="csv-upload"
                type="file"
                accept=".csv,text/csv"
                onChange={handleCsvUpload}
                className="hidden"
              />
              
              <Button
                onClick={() => document.getElementById('pdf-upload').click()}
                disabled={uploading}
                className="gap-2 bg-green-600 hover:bg-green-700"
              >
                <Upload className={`w-4 h-4 ${uploading ? 'animate-pulse' : ''}`} />
                {uploading ? 'Uploading...' : 'Upload PDF'}
              </Button>
              <input
                id="pdf-upload"
                type="file"
                accept="application/pdf"
                onChange={handlePdfUpload}
                className="hidden"
              />
            </div>
          </div>

          {syncProgress && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-lg mb-4 bg-blue-50 border border-blue-200 text-blue-800"
            >
              <div className="flex items-center gap-3">
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span className="font-medium">{syncProgress}</span>
              </div>
            </motion.div>
          )}

          {(syncStatus || uploadStatus) && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-4 rounded-lg mb-4 ${
                (syncStatus?.type === 'success' || uploadStatus?.type === 'success')
                  ? 'bg-green-50 border border-green-200 text-green-800' 
                  : 'bg-red-50 border border-red-200 text-red-800'
              }`}
            >
              <span>{syncStatus?.message || uploadStatus?.message}</span>
            </motion.div>
          )}

          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              type="text"
              placeholder="Search by name, home, work, mobile, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-white"
            />
          </div>
        </motion.div>

        {/* Pagination - Top */}
        {!loading && filteredCustomers.length > 0 && totalPages > 1 && (
          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Showing {startIndex + 1} to {Math.min(endIndex, filteredCustomers.length)} of {filteredCustomers.length} customers
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">
                  Page {currentPage} of {totalPages}
                </span>
              </div>
              <Button
                variant="outline"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <Card className="border-0 shadow-lg">
            <CardContent className="p-12 text-center">
              <p className="text-gray-600">
                {searchTerm ? 'No customers found matching your search.' : 'No customer information available yet.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-0 shadow-lg">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Home
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Work
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Mobile
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Customer ID
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {currentCustomers.map((customer) => (
                      <tr key={customer.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {customer.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {customer.home || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {customer.work || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {customer.mobile || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {customer.email || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {customer.customerID || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(customer.id)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pagination */}
        {filteredCustomers.length > 0 && totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Showing {startIndex + 1} to {Math.min(endIndex, filteredCustomers.length)} of {filteredCustomers.length} customers
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">
                  Page {currentPage} of {totalPages}
                </span>
              </div>
              <Button
                variant="outline"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}