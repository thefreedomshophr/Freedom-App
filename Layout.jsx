import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Shirt, Settings, LogOut, Lock, MapPin, Trash2, Sun, Moon, Home, ClipboardList } from "lucide-react";
import { useTheme } from "next-themes";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AnimatePresence, motion } from "framer-motion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

function LayoutContent({ children, currentPageName }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [user, setUser] = React.useState(null);
  const [userLoaded, setUserLoaded] = React.useState(false);
  const [customIcons, setCustomIcons] = React.useState({});
  const [selectedLocation, setSelectedLocation] = React.useState(null);
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(false);

  // Load user FIRST before anything else
  React.useEffect(() => {
    loadUser();
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Load other things after user is loaded
  React.useEffect(() => {
    if (userLoaded) {
      loadCustomIcons();
      loadSelectedLocation();
    }
  }, [userLoaded]);

  const checkMobile = () => {
    setIsMobile(window.innerWidth < 768);
  };

  const loadUser = async () => {
    try {
      const isAuth = await base44.auth.isAuthenticated();
      if (isAuth) {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
        
        // If user has a locked_location, auto-set it
        if (currentUser.locked_location) {
          const locations = await base44.entities.Location.list();
          const lockedLoc = locations.find(loc => loc.id === currentUser.locked_location);
          if (lockedLoc) {
            localStorage.setItem('selectedLocation', JSON.stringify(lockedLoc));
            setSelectedLocation(lockedLoc);
          }
        }
      }
    } catch (error) {
      console.error('Error loading user:', error);
    }
    setUserLoaded(true);
  };

  const loadCustomIcons = async () => {
    try {
      const icons = await base44.entities.CustomIcon.list();
      const iconMap = {};
      icons.forEach(icon => {
        iconMap[icon.identifier] = icon.icon_url;
      });
      setCustomIcons(iconMap);
    } catch (error) {
      console.error('Error loading custom icons:', error);
    }
  };

  const loadSelectedLocation = () => {
    const stored = localStorage.getItem('selectedLocation');
    if (stored) {
      try {
        setSelectedLocation(JSON.parse(stored));
      } catch (error) {
        setSelectedLocation(null);
      }
    }
  };

  const handleLogout = async () => {
    await base44.auth.logout();
    setUser(null);
  };

  const handleLock = () => {
    localStorage.removeItem('employeeCode');
    localStorage.removeItem('selectedPrints');
    localStorage.removeItem('orderBuilds');
    localStorage.removeItem('editingBuildIndex');
    localStorage.removeItem('pendingBuild');
    window.location.href = createPageUrl("EmployeeCode");
  };

  const handleChangeLocation = () => {
    window.location.href = createPageUrl("LocationSelection");
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      const response = await base44.functions.invoke('deleteMyAccount', {});
      if (response.data.success) {
        await base44.auth.logout();
      } else {
        throw new Error(response.data.error || 'Failed to delete account');
      }
    } catch (error) {
      console.error('Error deleting account:', error);
      alert('Failed to delete account: ' + error.message);
      setDeleting(false);
    }
  };

  const isAdminPage = location.pathname.includes('/admin');
  const isLocationSelectionPage = location.pathname.toLowerCase().includes('locationselection');

  // PERMISSION FLAGS - only valid after userLoaded is true
  const showAdminButton = userLoaded && user && user.role === 'admin';
  const showLocationButton = userLoaded && user && user.role === 'admin' && !user.locked_location;

  // Show loading spinner until user is loaded
  if (!userLoaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-foreground"></div>
      </div>
    );
  }

  // Check if user is authorized (admins are always authorized)
  const isAuthorized = user?.role === 'admin' || user?.is_authorized === true;
  
  // Show waiting for authorization screen if not authorized
  if (user && !isAuthorized) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <div className="w-20 h-20 bg-yellow-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <Lock className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-light text-foreground mb-4">Waiting for Authorization</h1>
          <p className="text-muted-foreground mb-6">
            Your account has been created but needs to be authorized by an administrator before you can access the app.
          </p>
          <p className="text-muted-foreground text-sm mb-8">
            Please contact your administrator to authorize your account.
          </p>
          <Button
            onClick={handleLogout}
            variant="outline"
            className="gap-2"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </Button>
        </div>
      </div>
    );
    }

    return (
      <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="bg-card border-b border-border sticky top-0 z-50 backdrop-blur-sm bg-card/95" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to={createPageUrl("Home")} className="flex items-center gap-3 group no-select">
              <div className="w-10 h-10 bg-gradient-to-br from-gray-200 to-gray-400 rounded-lg flex items-center justify-center transform group-hover:scale-105 transition-transform duration-200">
                {customIcons['layout_home_button'] ? (
                  <img 
                    src={customIcons['layout_home_button']} 
                    alt="Home"
                    className="w-6 h-6 object-contain"
                  />
                ) : (
                  <Shirt className="w-6 h-6 text-gray-900" />
                )}
              </div>
              <span className="text-2xl font-light tracking-wider text-foreground">
                FREEDOM
              </span>
            </Link>

            <div className="flex items-center gap-4">
              {/* Location button - ONLY for admins without locked location */}
              {!isMobile && !isLocationSelectionPage && (
                <Link to={createPageUrl("ActiveOrders")}>
                  <Button variant="ghost" className="gap-2 no-select">
                    Active Orders
                  </Button>
                </Link>
              )}

              {!isLocationSelectionPage && selectedLocation && showLocationButton && (
                <Button
                  variant="ghost"
                  onClick={handleChangeLocation}
                  className="gap-2 no-select"
                  title="Change location"
                >
                  <MapPin className="w-4 h-4" />
                  <span className="hidden md:inline">{selectedLocation.name}</span>
                </Button>
              )}

              {!isLocationSelectionPage && (
                <Button
                  variant="ghost"
                  onClick={handleLock}
                  className="gap-2 no-select"
                  title="Lock and return to employee code"
                >
                  <Lock className="w-4 h-4" />
                </Button>
              )}

              {/* Admin button - ONLY for users with role === 'admin' */}
              {!isMobile && !isLocationSelectionPage && showAdminButton && (
                <Link to={createPageUrl("AdminDashboard")}>
                  <Button variant={isAdminPage ? "default" : "ghost"} className="gap-2 no-select">
                    <Settings className="w-4 h-4" />
                    Admin
                  </Button>
                </Link>
              )}

              {!isLocationSelectionPage && user && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="gap-2 no-select">
                      <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium">
                          {user.full_name?.[0]?.toUpperCase() || 'U'}
                        </span>
                      </div>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {showLocationButton && (
                      <>
                        <DropdownMenuItem onClick={handleChangeLocation}>
                          <MapPin className="w-4 h-4 mr-2" />
                          Change Location
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    <DropdownMenuItem onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                      {theme === 'dark' ? <Sun className="w-4 h-4 mr-2" /> : <Moon className="w-4 h-4 mr-2" />}
                      {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout}>
                      <LogOut className="w-4 h-4 mr-2" />
                      Logout
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setShowDeleteDialog(true)} className="text-red-600 dark:text-red-400">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Account
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main 
        className="bg-background" 
        style={{ 
          minHeight: 'calc(100vh - 4rem)',
          paddingBottom: isMobile ? 'calc(env(safe-area-inset-bottom) + 4rem)' : 'env(safe-area-inset-bottom)'
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Mobile Bottom TabBar */}
      {isMobile && !isLocationSelectionPage && (
        <div 
          className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="flex justify-around items-center h-16">
            <button
              onClick={() => navigate(createPageUrl("Home"))}
              className={`flex flex-col items-center justify-center flex-1 h-full no-select ${
                location.pathname === createPageUrl("Home") ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <Home className="w-6 h-6" />
              <span className="text-xs mt-1">Home</span>
            </button>
            
            <button
              onClick={() => navigate(createPageUrl("ActiveOrders"))}
              className={`flex flex-col items-center justify-center flex-1 h-full no-select ${
                location.pathname === createPageUrl("ActiveOrders") ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <ClipboardList className="w-6 h-6" />
              <span className="text-xs mt-1">Orders</span>
            </button>
            
            {showAdminButton && (
              <button
                onClick={() => navigate(createPageUrl("AdminDashboard"))}
                className={`flex flex-col items-center justify-center flex-1 h-full no-select ${
                  isAdminPage ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                <Settings className="w-6 h-6" />
                <span className="text-xs mt-1">Admin</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Delete Account Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Account</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-4">
            <Button
              onClick={() => setShowDeleteDialog(false)}
              variant="outline"
              disabled={deleting}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteAccount}
              disabled={deleting}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? 'Deleting...' : 'Delete Account'}
            </Button>
          </div>
        </DialogContent>
        </Dialog>
        </div>
        );
        }

        export default function Layout({ children, currentPageName }) {
        return (
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <LayoutContent children={children} currentPageName={currentPageName} />
        </ThemeProvider>
        );
        }