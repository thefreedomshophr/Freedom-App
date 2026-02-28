import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Search } from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";

export default function AdminPreprintLogs() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [user, setUser] = useState(null);

  useEffect(() => {
    checkPermissions();
  }, []);

  useEffect(() => {
    let filtered = logs;
    
    if (searchTerm) {
      filtered = filtered.filter(log =>
        log.sale_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.location_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.employee_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.preprint_system_id?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    setFilteredLogs(filtered);
  }, [searchTerm, logs]);

  const checkPermissions = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      if (currentUser.role === 'admin') {
        loadLogs();
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error('Error checking permissions:', error);
      setLoading(false);
    }
  };

  const loadLogs = async () => {
    try {
      const data = await base44.entities.PreprintLog.list('-created_date', 500);
      setLogs(data);
      setFilteredLogs(data);
    } catch (error) {
      console.error('Error loading logs:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] p-12 flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-[calc(100vh-4rem)] p-12">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-3xl font-light mb-4">Access Denied</h1>
          <p className="text-muted-foreground mb-8">You don't have permission to view preprint logs.</p>
          <Button onClick={() => navigate(createPageUrl("Home"))}>
            Return Home
          </Button>
        </div>
      </div>
    );
  }

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
          <h1 className="text-4xl font-light mb-2">Preprint Logs</h1>
          <p className="text-muted-foreground">View when employees chose to produce instead of using preprints</p>
        </motion.div>

        <Card className="border-0 shadow-lg">
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <CardTitle>All Logs ({filteredLogs.length})</CardTitle>
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search logs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-64"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Date</th>
                    <th className="text-left py-3 px-4">Sale ID</th>
                    <th className="text-left py-3 px-4">Location</th>
                    <th className="text-left py-3 px-4">Employee</th>
                    <th className="text-left py-3 px-4">Preprint System ID</th>
                    <th className="text-left py-3 px-4">Components</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4 text-muted-foreground text-sm">
                        {format(new Date(log.created_date), 'MMM d, yyyy h:mm a')}
                      </td>
                      <td className="py-3 px-4 font-mono text-sm">{log.sale_id || '-'}</td>
                      <td className="py-3 px-4 text-muted-foreground">{log.location_name}</td>
                      <td className="py-3 px-4 text-muted-foreground">{log.employee_name}</td>
                      <td className="py-3 px-4 font-mono text-sm">{log.preprint_system_id}</td>
                      <td className="py-3 px-4 text-muted-foreground text-sm">
                        <div className="space-y-1">
                          <div>Blank: {log.blank_system_id}</div>
                          <div>Print1: {log.print1_system_id}</div>
                          {log.print2_system_id && <div>Print2: {log.print2_system_id}</div>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}