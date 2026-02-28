import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Plus, Trash2, Pencil, Check, X, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export default function AdminEmployeeCodes() {
  const navigate = useNavigate();
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [editingCode, setEditingCode] = useState(null);
  const [formData, setFormData] = useState({ code: '', employee_name: '', employeeID: '', is_active: true });
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadCodes();
  }, []);

  const loadCodes = async () => {
    const data = await base44.entities.EmployeeCode.list('-created_date');
    setCodes(data);
    setLoading(false);
  };

  const handleAdd = () => {
    setEditingCode(null);
    setFormData({ code: '', employee_name: '', employeeID: '', is_active: true });
    setShowDialog(true);
  };

  const handleEdit = (code) => {
    setEditingCode(code);
    setFormData({ 
      code: code.code, 
      employee_name: code.employee_name || '', 
      employeeID: code.employeeID || '',
      is_active: code.is_active !== false 
    });
    setShowDialog(true);
  };

  const handleSyncEmployees = async () => {
    setSyncing(true);
    try {
      // Get selected location
      const selectedLocationData = localStorage.getItem('selectedLocation');
      if (!selectedLocationData) {
        alert('No location selected');
        setSyncing(false);
        return;
      }
      
      const selectedLocation = JSON.parse(selectedLocationData);
      
      console.log('Calling lightspeedGetEmployees for location:', selectedLocation.id);
      const response = await base44.functions.invoke('lightspeedGetEmployees', { locationId: selectedLocation.id });
      console.log('Response:', response);
      
      if (!response.data.success) {
        alert(`Failed to sync employees from Lightspeed: ${response.data.error || 'Unknown error'}`);
        setSyncing(false);
        return;
      }

      const employees = response.data.employees;
      
      // Get existing employee codes
      const existingCodes = await base44.entities.EmployeeCode.list();
      
      // Update or create employee codes
      for (const emp of employees) {
        const fullName = `${emp.firstName} ${emp.lastName}`.trim();
        const existing = existingCodes.find(c => c.employeeID === emp.employeeID);
        
        if (existing) {
          // Update existing
          await base44.entities.EmployeeCode.update(existing.id, {
            employee_name: fullName,
            employeeID: emp.employeeID
          });
        } else {
          // Create new with employeeCode as the code
          await base44.entities.EmployeeCode.create({
            code: emp.employeeCode || emp.employeeID,
            employee_name: fullName,
            employeeID: emp.employeeID,
            is_active: true
          });
        }
      }
      
      await loadCodes();
      alert(`Successfully synced ${employees.length} employees from Lightspeed`);
    } catch (error) {
      console.error('Error syncing employees:', error);
      console.error('Error details:', error.message, error.stack);
      alert(`Failed to sync employees: ${error.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleSave = async () => {
    if (!formData.code.trim()) {
      alert('Employee code is required');
      return;
    }

    try {
      if (editingCode) {
        await base44.entities.EmployeeCode.update(editingCode.id, formData);
      } else {
        await base44.entities.EmployeeCode.create(formData);
      }
      await loadCodes();
      setShowDialog(false);
    } catch (error) {
      console.error('Error saving employee code:', error);
      alert('Failed to save employee code');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this employee code?')) return;
    
    try {
      await base44.entities.EmployeeCode.delete(id);
      await loadCodes();
    } catch (error) {
      console.error('Error deleting employee code:', error);
      alert('Failed to delete employee code');
    }
  };

  const toggleActive = async (code) => {
    try {
      await base44.entities.EmployeeCode.update(code.id, { is_active: !code.is_active });
      await loadCodes();
    } catch (error) {
      console.error('Error updating employee code:', error);
      alert('Failed to update employee code');
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] p-6 md:p-12">
      <div className="max-w-6xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate(createPageUrl("AdminDashboard"))}
          className="mb-4 gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Button>

        <div className="flex justify-between items-center mb-8">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <h1 className="text-4xl md:text-5xl font-light mb-2">
              Employee Codes
            </h1>
            <p className="text-muted-foreground font-light">
              Manage employee access codes
            </p>
          </motion.div>

          <div className="flex gap-3">
            <Button
              onClick={handleSyncEmployees}
              disabled={syncing}
              className="gap-2 bg-green-600 hover:bg-green-700"
            >
              <RefreshCw className={`w-5 h-5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync from Lightspeed'}
            </Button>
            <Button
              onClick={handleAdd}
              className="gap-2 bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-5 h-5" />
              Add Code
            </Button>
          </div>
        </div>

        <div className="mb-6">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by employee name..."
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-foreground"></div>
          </div>
        ) : (
          <Card className="border-0 shadow-lg">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Employee Name</TableHead>
                      <TableHead>Employee ID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="w-32">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {codes.filter(code => 
                      !searchQuery || 
                      code.employee_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      code.code?.toLowerCase().includes(searchQuery.toLowerCase())
                    ).map((code) => (
                      <TableRow key={code.id}>
                        <TableCell className="font-mono">{code.code}</TableCell>
                        <TableCell>{code.employee_name || '-'}</TableCell>
                        <TableCell className="font-mono text-muted-foreground">{code.employeeID || '-'}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={code.is_active !== false}
                              onCheckedChange={() => toggleActive(code)}
                            />
                            <span className={code.is_active !== false ? "text-green-500" : "text-muted-foreground"}>
                              {code.is_active !== false ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(code.created_date).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(code)}
                              className="text-blue-500"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(code.id)}
                              className="text-red-500"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Add/Edit Dialog */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingCode ? 'Edit Employee Code' : 'Add Employee Code'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Employee Code *</Label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({...formData, code: e.target.value})}
                  placeholder="Enter code"
                />
              </div>
              <div>
                <Label>Employee Name</Label>
                <Input
                  value={formData.employee_name}
                  onChange={(e) => setFormData({...formData, employee_name: e.target.value})}
                  placeholder="Enter employee name"
                />
              </div>
              <div>
                <Label>Employee ID (Lightspeed)</Label>
                <Input
                  value={formData.employeeID}
                  onChange={(e) => setFormData({...formData, employeeID: e.target.value})}
                  placeholder="Enter Lightspeed employee ID"
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({...formData, is_active: checked})}
                />
                <Label>Active</Label>
              </div>
              <div className="flex gap-3 mt-6">
                <Button
                  onClick={() => setShowDialog(false)}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Save
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}