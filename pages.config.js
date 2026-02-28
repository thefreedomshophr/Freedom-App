/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import ActiveOrders from './pages/ActiveOrders';
import AdminCategories from './pages/AdminCategories';
import AdminColorGroups from './pages/AdminColorGroups';
import AdminColors from './pages/AdminColors';
import AdminCustomerInfo from './pages/AdminCustomerInfo';
import AdminDashboard from './pages/AdminDashboard';
import AdminDiscontinued from './pages/AdminDiscontinued';
import AdminEmployeeCodes from './pages/AdminEmployeeCodes';
import AdminFunctionTest from './pages/AdminFunctionTest';
import AdminGarmentTest from './pages/AdminGarmentTest';
import AdminGarments from './pages/AdminGarments';
import AdminIcons from './pages/AdminIcons';
import AdminItemIDs from './pages/AdminItemIDs';
import AdminLocationApiSetup from './pages/AdminLocationApiSetup';
import AdminLocations from './pages/AdminLocations';
import AdminLogs from './pages/AdminLogs';
import AdminMerchandise from './pages/AdminMerchandise';
import AdminPlacements from './pages/AdminPlacements';
import AdminPosSetup from './pages/AdminPosSetup';
import AdminPreprintLogs from './pages/AdminPreprintLogs';
import AdminPreprints from './pages/AdminPreprints';
import AdminPrinterServer from './pages/AdminPrinterServer';
import AdminPrints from './pages/AdminPrints';
import AdminStyleThumbnails from './pages/AdminStyleThumbnails';
import AdminStyles from './pages/AdminStyles';
import AdminUsers from './pages/AdminUsers';
import ColorSelection from './pages/ColorSelection';
import EmployeeCode from './pages/EmployeeCode';
import GarmentChoiceSelection from './pages/GarmentChoiceSelection';
import GarmentTypeSelection from './pages/GarmentTypeSelection';
import Home from './pages/Home';
import LocationPrinterSetup from './pages/LocationPrinterSetup';
import LocationSelection from './pages/LocationSelection';
import OrderSummary from './pages/OrderSummary';
import Preview from './pages/Preview';
import PrintCatalog from './pages/PrintCatalog';
import PrintCategorySelection from './pages/PrintCategorySelection';
import SizeSelection from './pages/SizeSelection';
import StyleGroupSelection from './pages/StyleGroupSelection';
import StyleSelection from './pages/StyleSelection';
import __Layout from './Layout.jsx';


export const PAGES = {
    "ActiveOrders": ActiveOrders,
    "AdminCategories": AdminCategories,
    "AdminColorGroups": AdminColorGroups,
    "AdminColors": AdminColors,
    "AdminCustomerInfo": AdminCustomerInfo,
    "AdminDashboard": AdminDashboard,
    "AdminDiscontinued": AdminDiscontinued,
    "AdminEmployeeCodes": AdminEmployeeCodes,
    "AdminFunctionTest": AdminFunctionTest,
    "AdminGarmentTest": AdminGarmentTest,
    "AdminGarments": AdminGarments,
    "AdminIcons": AdminIcons,
    "AdminItemIDs": AdminItemIDs,
    "AdminLocationApiSetup": AdminLocationApiSetup,
    "AdminLocations": AdminLocations,
    "AdminLogs": AdminLogs,
    "AdminMerchandise": AdminMerchandise,
    "AdminPlacements": AdminPlacements,
    "AdminPosSetup": AdminPosSetup,
    "AdminPreprintLogs": AdminPreprintLogs,
    "AdminPreprints": AdminPreprints,
    "AdminPrinterServer": AdminPrinterServer,
    "AdminPrints": AdminPrints,
    "AdminStyleThumbnails": AdminStyleThumbnails,
    "AdminStyles": AdminStyles,
    "AdminUsers": AdminUsers,
    "ColorSelection": ColorSelection,
    "EmployeeCode": EmployeeCode,
    "GarmentChoiceSelection": GarmentChoiceSelection,
    "GarmentTypeSelection": GarmentTypeSelection,
    "Home": Home,
    "LocationPrinterSetup": LocationPrinterSetup,
    "LocationSelection": LocationSelection,
    "OrderSummary": OrderSummary,
    "Preview": Preview,
    "PrintCatalog": PrintCatalog,
    "PrintCategorySelection": PrintCategorySelection,
    "SizeSelection": SizeSelection,
    "StyleGroupSelection": StyleGroupSelection,
    "StyleSelection": StyleSelection,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};