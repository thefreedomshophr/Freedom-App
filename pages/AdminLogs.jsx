import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Trash2, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";

export default function AdminLogs() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkPermissions();
    loadLogs();
  }, []);

  const checkPermissions = async () => {
    try {
      const currentUser = await base44.auth.me();
      if (currentUser.role !== 'admin') {
        navigate(createPageUrl("AdminDashboard"));
      }
    } catch (error) {
      console.error('Error checking permissions:', error);
      navigate(createPageUrl("Home"));
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async () => {
    try {
      const data = await base44.entities.DeviceLog.list('-created_date', 500);
      setLogs(data);
    } catch (error) {
      console.error('Error loading logs:', error);
    }
  };

  const handleClearLogs = async () => {
    if (!confirm('Delete all logs?')) return;
    
    try {
      for (const log of logs) {
        await base44.entities.DeviceLog.delete(log.id);
      }
      setLogs([]);
      alert('All logs cleared');
    } catch (error) {
      console.error('Error clearing logs:', error);
      alert('Failed to clear logs');
    }
  };

  const getLevelColor = (level) => {
    switch (level) {
      case 'error': return 'text-red-400';
      case 'warn': return 'text-yellow-400';
      default: return 'text-blue-400';
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] p-12 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-foreground"></div>
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
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-light mb-2">Device Logs</h1>
              <p className="text-muted-foreground">{logs.length} logs</p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={loadLogs}
                variant="outline"
                className="gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </Button>
              <Button
                onClick={handleClearLogs}
                variant="outline"
                className="gap-2 text-red-500 border-red-500 hover:bg-red-500 hover:text-white"
              >
                <Trash2 className="w-4 h-4" />
                Clear All
              </Button>
            </div>
          </div>
        </motion.div>

        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg">Recent Logs</CardTitle>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <p className="text-muted-foreground">No logs yet</p>
            ) : (
              <div className="space-y-3">
                {logs.map((log) => (
                  <div key={log.id} className="bg-muted p-4 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <span className={`font-mono text-sm ${getLevelColor(log.level)}`}>
                        [{log.level?.toUpperCase()}]
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(log.created_date).toLocaleString()}
                      </span>
                    </div>
                    <p className="mb-2">{log.message}</p>
                    {log.data && (
                      <pre className="text-xs text-muted-foreground bg-background p-2 rounded overflow-x-auto">
                        {log.data}
                      </pre>
                    )}
                    {log.device_info && (
                      <p className="text-xs text-muted-foreground mt-2">Device: {log.device_info}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}