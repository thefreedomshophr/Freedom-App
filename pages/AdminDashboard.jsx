import React from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shirt, Image, Palette, ArrowLeft, User, LogIn, TestTube, Archive, Printer, Shapes } from "lucide-react";
import { motion } from "framer-motion";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [needsAuth, setNeedsAuth] = React.useState(false);

  React.useEffect(() => {
    checkAdmin();
  }, []);

  const checkAdmin = async () => {
    try {
      const isAuth = await base44.auth.isAuthenticated();
      if (!isAuth) {
        setNeedsAuth(true);
        setLoading(false);
        return;
      }
      
      try {
        const currentUser = await base44.auth.me();
        if (currentUser.role !== 'admin' && !currentUser.can_manage_prints && !currentUser.can_manage_garments && !currentUser.can_manage_colors) {
          setNeedsAuth(true);
          setLoading(false);
          return;
        }
        setUser(currentUser);
        setLoading(false);
      } catch (error) {
        // Could not fetch user, possibly token expired or invalid, or user removed.
        console.error("Failed to fetch current user after authentication:", error);
        setNeedsAuth(true);
        setLoading(false);
      }
    } catch (error) {
      // Not authenticated - expected for unauthenticated users
      console.error("Authentication check failed:", error);
      setNeedsAuth(true);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-foreground"></div>
      </div>
    );
  }

  if (needsAuth) {
    return (
      <div className="min-h-[calc(100vh-4rem)] p-6 md:p-12 flex items-center justify-center">
        <Card className="shadow-lg p-12 text-center max-w-md">
          <h2 className="text-3xl font-light mb-4">Admin Access Required</h2>
          <p className="text-muted-foreground mb-8">You need to sign in with an admin account to access this area.</p>
          <div className="flex flex-col gap-3">
            <Button
              onClick={() => {
                console.log('Redirecting to login...');
                base44.auth.redirectToLogin(window.location.href);
              }}
              className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <LogIn className="w-4 h-4" />
              Sign In
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate(createPageUrl("Home"))}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Go Back Home
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const sections = [
    {
      title: "Manage Prints",
      description: "Upload and edit print designs",
      icon: Image,
      gradient: "from-purple-500 to-pink-500",
      path: "AdminPrints",
      permission: "can_manage_prints"
    },
    {
      title: "Manage Garments",
      description: "Upload and edit garment catalog",
      icon: Shirt,
      gradient: "from-blue-500 to-cyan-500",
      path: "AdminGarments",
      permission: "can_manage_garments"
    },
    {
      title: "Manage Preprints",
      description: "Manage preprinted garment configurations",
      icon: Shirt,
      gradient: "from-purple-500 to-purple-600",
      path: "AdminPreprints",
      permission: "admin_only"
    },
    {
      title: "Manage Categories",
      description: "View Lightspeed categories",
      icon: Image,
      gradient: "from-cyan-500 to-teal-500",
      path: "AdminCategories",
      permission: "admin_only"
    },
    {
      title: "Preprint Logs",
      description: "View preprint bypass logs",
      icon: Shirt,
      gradient: "from-indigo-500 to-indigo-600",
      path: "AdminPreprintLogs",
      permission: "admin_only"
    },
    {
      title: "Style Thumbnails",
      description: "Manage thumbnail images for style selection",
      icon: Image,
      gradient: "from-pink-500 to-rose-500",
      path: "AdminStyleThumbnails",
      permission: "can_manage_garments"
    },
    {
      title: "Manage Styles",
      description: "Add and edit garment styles",
      icon: Shirt,
      gradient: "from-teal-500 to-cyan-500",
      path: "AdminStyles",
      permission: "can_manage_garments"
    },
    {
      title: "Placement Options",
      description: "Manage print placement options",
      icon: Image,
      gradient: "from-indigo-500 to-blue-500",
      path: "AdminPlacements",
      permission: "can_manage_garments"
    },
    {
      title: "Manage Colors",
      description: "Set available garment colors",
      icon: Palette,
      gradient: "from-orange-500 to-red-500",
      path: "AdminColors",
      permission: "can_manage_colors"
    },
    {
      title: "Color Groups",
      description: "Manage color groupings",
      icon: Palette,
      gradient: "from-red-500 to-pink-500",
      path: "AdminColorGroups",
      permission: "can_manage_colors"
    },
    {
      title: "Manage Locations",
      description: "Configure store locations",
      icon: User,
      gradient: "from-blue-500 to-indigo-500",
      path: "AdminLocations",
      permission: "admin_only"
    },
    {
      title: "Manage Merchandise",
      description: "Manage merchandise inventory",
      icon: Image,
      gradient: "from-emerald-500 to-teal-500",
      path: "AdminMerchandise",
      permission: "admin_only"
    },
    {
      title: "Manage Icons",
      description: "Customize page icons",
      icon: Image,
      gradient: "from-indigo-500 to-purple-500",
      path: "AdminIcons",
      permission: "admin_only"
    },
    {
      title: "Manage Users",
      description: "Manage user accounts",
      icon: User,
      gradient: "from-green-500 to-teal-500",
      path: "AdminUsers",
      permission: "admin_only"
    },
    {
      title: "Employee Codes",
      description: "Manage employee access codes",
      icon: User,
      gradient: "from-violet-500 to-purple-500",
      path: "AdminEmployeeCodes",
      permission: "admin_only"
    },
    {
      title: "Customer Information",
      description: "View customer orders",
      icon: User,
      gradient: "from-yellow-500 to-orange-500",
      path: "AdminCustomerInfo",
      permission: "admin_only"
    },
    {
      title: "POS Integration",
      description: "Connect to Lightspeed POS",
      icon: User,
      gradient: "from-red-500 to-rose-500",
      path: "AdminPosSetup",
      permission: "admin_only"
    },
    {
      title: "Manage itemIDs",
      description: "Upload and manage itemID mappings",
      icon: User,
      gradient: "from-cyan-500 to-blue-500",
      path: "AdminItemIDs",
      permission: "admin_only"
    },
    {
      title: "Printer Server",
      description: "Configure Raspberry Pi printer server",
      icon: User,
      gradient: "from-purple-500 to-pink-500",
      path: "AdminPrinterServer",
      permission: "admin_only"
      },
      {
      title: "Device Logs",
      description: "View logs from all devices",
      icon: User,
      gradient: "from-gray-500 to-gray-600",
      path: "AdminLogs",
      permission: "admin_only"
      },
      {
      title: "Function Test",
      description: "Test backend functions with custom payloads",
      icon: TestTube,
      gradient: "from-purple-500 to-purple-600",
      path: "AdminFunctionTest",
      permission: "admin_only"
      },
      {
      title: "Discontinued",
      description: "View discontinued inventory across locations",
      icon: Archive,
      gradient: "from-amber-500 to-orange-600",
      path: "AdminDiscontinued",
      permission: "admin_only"
      },
      {
      title: "Printer Setup",
      description: "Configure StarIO printers by location",
      icon: Printer,
      gradient: "from-green-500 to-emerald-500",
      path: "LocationPrinterSetup",
      permission: "admin_only"
      },
      {
      title: "Garment Test Studio",
      description: "Test new garment SVGs with print previews",
      icon: Shapes,
      gradient: "from-blue-500 to-purple-500",
      path: "AdminGarmentTest",
      permission: "admin_only"
      }
      ];

  const visibleSections = sections.filter(section => {
    if (section.permission === "admin_only") {
      return user?.role === 'admin';
    }
    return user?.[section.permission] === true;
  });

  return (
    <div className="min-h-[calc(10vh-4rem)] p-6 md:p-12">
      <div className="max-w-6xl mx-auto">
        <div className="mb-4">
          <Button
            variant="ghost"
            onClick={() => navigate(createPageUrl("Home"))}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Button>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-light text-foreground mb-2">
            Admin Dashboard
          </h1>
          <p className="text-muted-foreground font-light">
            Manage your catalog and inventory
          </p>
        </motion.div>

        {visibleSections.length === 0 ? (
          <Card className="shadow-lg p-8 text-center">
            <p className="text-muted-foreground">You don't have permission to access any management features.</p>
          </Card>
        ) : (
          <div className="grid md:grid-cols-3 gap-8">
            {visibleSections.map((section, index) => (
              <motion.div
                key={section.title}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card 
                  className="cursor-pointer group hover:shadow-2xl transition-all duration-300 overflow-hidden rounded-3xl h-full"
                  onClick={() => navigate(createPageUrl(section.path))}
                >
                  <CardContent className="p-0">
                    <div className={`h-48 bg-gradient-to-br ${section.gradient} flex items-center justify-center relative overflow-hidden rounded-t-3xl`}>
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
                      <section.icon className="w-20 h-20 text-white transform group-hover:scale-110 transition-transform duration-300" />
                    </div>
                    <div className="p-8">
                      <h3 className="text-2xl font-light text-foreground mb-2">
                        {section.title}
                      </h3>
                      <p className="text-muted-foreground font-light">
                        {section.description}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}