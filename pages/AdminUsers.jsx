import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Pencil, Trash2, ArrowLeft, UserPlus, Check, Clock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import PullToRefresh from "../components/PullToRefresh";

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentUser, setCurrentUser] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    loadCurrentUser();
    loadUsers();
    loadLocations();
  }, []);

  const loadCurrentUser = async () => {
    try {
      const user = await base44.auth.me();
      setCurrentUser(user);
    } catch (error) {
      console.error('Error loading current user:', error);
    }
  };

  const loadUsers = async () => {
    try {
      const data = await base44.entities.User.list('-created_date');
      setUsers(data);
    } catch (error) {
      console.error('Error loading users:', error);
    }
    setLoading(false);
  };

  const loadLocations = async () => {
    try {
      const data = await base44.entities.Location.list();
      setLocations(data);
    } catch (error) {
      console.error('Error loading locations:', error);
    }
  };

  const handleEdit = (user) => {
    // Initialize new_password field when editing a user
    setEditingUser({ ...user, new_password: '' });
    setShowDialog(true);
  };

  const handleSave = async () => {
    try {
      if (editingUser.id) {
        const updateData = {
          full_name: editingUser.full_name,
          role: editingUser.role,
          can_manage_prints: editingUser.can_manage_prints || false,
          can_manage_garments: editingUser.can_manage_garments || false,
          can_manage_colors: editingUser.can_manage_colors || false,
          locked_location: editingUser.locked_location || null
        };
        
        // Only include password if it was changed
        if (editingUser.new_password && editingUser.new_password.trim() !== '') {
          updateData.password = editingUser.new_password;
        }
        
        await base44.entities.User.update(editingUser.id, updateData);
      }
      setShowDialog(false);
      setEditingUser(null);
      loadUsers();
    } catch (error) {
      console.error('Error saving user:', error);
      alert('Error saving user. Please try again.');
    }
  };

  const handleDelete = async (user) => {
    if (user.id === currentUser?.id) {
      alert('You cannot delete your own account.');
      return;
    }

    if (window.confirm(`Are you sure you want to delete ${user.email}? This action cannot be undone.`)) {
      try {
        await base44.entities.User.delete(user.id);
        loadUsers();
      } catch (error) {
        console.error('Error deleting user:', error);
        alert('Error deleting user. Please try again.');
      }
    }
  };

  const handleAuthorize = async (user) => {
    try {
      await base44.entities.User.update(user.id, { is_authorized: true });
      loadUsers();
    } catch (error) {
      console.error('Error authorizing user:', error);
      alert('Error authorizing user. Please try again.');
    }
  };

  const filteredUsers = users.filter(u =>
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <PullToRefresh onRefresh={loadUsers}>
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

        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-light mb-2">User Management</h1>
            <p className="text-muted-foreground font-light">Manage user accounts and permissions</p>
          </div>
        </div>

        <Alert className="mb-6 bg-blue-50 border-blue-200">
          <AlertDescription className="text-blue-800">
            <strong>Note:</strong> To add new users, please use the "Invite User" functionality in the base44 dashboard.
            New users will receive an email invitation to set their password and create their account.
          </AlertDescription>
        </Alert>

        <Card className="border-0 shadow-lg">
          <CardHeader className="border-b">
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search by email or name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="text-sm text-muted-foreground">
                {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-foreground mx-auto"></div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Full Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Permissions</TableHead>
                      <TableHead>Created Date</TableHead>
                      <TableHead className="w-32">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          No users found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUsers.map((user) => {
                        const isAuthorized = user.role === 'admin' || user.is_authorized === true;
                        return (
                        <TableRow key={user.id}>
                          <TableCell>
                            {isAuthorized ? (
                              <Badge className="bg-green-100 text-green-800 gap-1">
                                <Check className="w-3 h-3" />
                                Authorized
                              </Badge>
                            ) : (
                              <Badge className="bg-yellow-100 text-yellow-800 gap-1">
                                <Clock className="w-3 h-3" />
                                Waiting
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">{user.email}</TableCell>
                          <TableCell>{user.full_name || '-'}</TableCell>
                          <TableCell>
                            <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                              {user.role}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {user.locked_location ? (
                              <Badge variant="secondary" className="text-xs">
                                {locations.find(l => l.id === user.locked_location)?.name || 'Locked'}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">Any</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1 flex-wrap">
                              {user.can_manage_prints && (
                                <Badge variant="outline" className="text-xs">Prints</Badge>
                              )}
                              {user.can_manage_garments && (
                                <Badge variant="outline" className="text-xs">Garments</Badge>
                              )}
                              {user.can_manage_colors && (
                                <Badge variant="outline" className="text-xs">Colors</Badge>
                              )}
                              {!user.can_manage_prints && !user.can_manage_garments && !user.can_manage_colors && (
                                <span className="text-xs text-muted-foreground">None</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(user.created_date).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              {!isAuthorized && (
                                <Button
                                  size="sm"
                                  onClick={() => handleAuthorize(user)}
                                  className="bg-green-600 hover:bg-green-700 text-white"
                                >
                                  Authorize
                                </Button>
                              )}
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleEdit(user)}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleDelete(user)}
                                disabled={user.id === currentUser?.id}
                              >
                                <Trash2 className={`w-4 h-4 ${user.id === currentUser?.id ? 'text-muted-foreground' : 'text-red-500'}`} />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )})
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
            </DialogHeader>
            {editingUser && (
              <div className="space-y-4">
                <div>
                  <Label>Email</Label>
                  <Input
                    value={editingUser.email}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Email cannot be changed</p>
                </div>
                <div>
                  <Label>Full Name</Label>
                  <Input
                    value={editingUser.full_name || ''}
                    onChange={(e) => setEditingUser({...editingUser, full_name: e.target.value})}
                    placeholder="Enter full name"
                  />
                </div>
                <div>
                  <Label>Role</Label>
                  <Select
                    value={editingUser.role}
                    onValueChange={(value) => setEditingUser({...editingUser, role: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>New Password (leave blank to keep current)</Label>
                  <Input
                    type="password"
                    value={editingUser.new_password || ''}
                    onChange={(e) => setEditingUser({...editingUser, new_password: e.target.value})}
                    placeholder="Enter new password"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Minimum 8 characters, at least one uppercase, one lowercase, one number, one special character.
                  </p>
                </div>

                <div className="border-t pt-4">
                  <Label className="mb-3 block">Location Lock</Label>
                  <Select
                    value={editingUser.locked_location || "none"}
                    onValueChange={(value) => setEditingUser({...editingUser, locked_location: value === "none" ? null : value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="No location lock" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No location lock</SelectItem>
                      {locations.map(loc => (
                        <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">If set, user cannot change their location</p>
                </div>

                <div className="border-t pt-4">
                  <Label className="mb-3 block">Management Permissions</Label>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="manage-prints"
                        checked={editingUser.can_manage_prints || false}
                        onChange={(e) => setEditingUser({...editingUser, can_manage_prints: e.target.checked})}
                        className="w-4 h-4 rounded"
                      />
                      <label htmlFor="manage-prints" className="text-sm cursor-pointer">
                        Can Manage Prints
                      </label>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="manage-garments"
                        checked={editingUser.can_manage_garments || false}
                        onChange={(e) => setEditingUser({...editingUser, can_manage_garments: e.target.checked})}
                        className="w-4 h-4 rounded"
                      />
                      <label htmlFor="manage-garments" className="text-sm cursor-pointer">
                        Can Manage Garments
                      </label>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="manage-colors"
                        checked={editingUser.can_manage_colors || false}
                        onChange={(e) => setEditingUser({...editingUser, can_manage_colors: e.target.checked})}
                        className="w-4 h-4 rounded"
                      />
                      <label htmlFor="manage-colors" className="text-sm cursor-pointer">
                        Can Manage Colors
                      </label>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={handleSave}
                  className="w-full"
                >
                  Save Changes
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
    </PullToRefresh>
  );
}