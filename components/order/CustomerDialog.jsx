import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function CustomerDialog({
  open,
  onOpenChange,
  customerStep,
  setCustomerStep,
  customerInfo,
  setCustomerInfo,
  existingCustomerID,
  setExistingCustomerID,
  searchingCustomer,
  submitting,
  statusMessage,
  onSearch,
  onSkip,
  onSubmit,
}) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      onOpenChange(isOpen);
      if (!isOpen) {
        setCustomerStep('phone');
        setCustomerInfo({ firstName: '', lastName: '', phone: '', email: '' });
        setExistingCustomerID(null);
      }
    }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Customer Information</DialogTitle>
          <DialogDescription>
            {customerStep === 'phone'
              ? "Enter the customer's phone number"
              : existingCustomerID
                ? 'Review and update customer information'
                : 'Enter customer details'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          {customerStep === 'phone' ? (
            <>
              <div>
                <Label htmlFor="customerPhone">Phone Number *</Label>
                <Input
                  id="customerPhone"
                  type="tel"
                  value={customerInfo.phone}
                  onChange={(e) => {
                    const cleaned = e.target.value.replace(/\D/g, '');
                    let formatted = '';
                    if (cleaned.length > 0) {
                      formatted = '(' + cleaned.substring(0, 3);
                      if (cleaned.length >= 4) formatted += ') ' + cleaned.substring(3, 6);
                      if (cleaned.length >= 7) formatted += '-' + cleaned.substring(6, 10);
                    }
                    setCustomerInfo({ ...customerInfo, phone: formatted });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && customerInfo.phone.trim()) onSearch();
                  }}
                  placeholder="(503) 440-5403"
                  autoFocus
                />
              </div>
              <div className="flex gap-3 mt-6">
                <Button
                  onClick={() => { onOpenChange(false); setCustomerStep('phone'); setCustomerInfo({ firstName: '', lastName: '', phone: '', email: '' }); }}
                  variant="outline"
                  className="flex-1"
                  disabled={searchingCustomer}
                >
                  Cancel
                </Button>
                <Button onClick={onSkip} variant="outline" className="flex-1" disabled={searchingCustomer}>
                  Skip
                </Button>
                <Button
                  onClick={onSearch}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={!customerInfo.phone.trim() || searchingCustomer}
                >
                  {statusMessage || (searchingCustomer ? 'Searching...' : 'Next')}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div>
                <Label htmlFor="customerFirstName">First Name *</Label>
                <Input
                  id="customerFirstName"
                  value={customerInfo.firstName}
                  onChange={(e) => setCustomerInfo({ ...customerInfo, firstName: e.target.value })}
                  placeholder="Enter first name"
                  autoFocus
                />
              </div>
              <div>
                <Label htmlFor="customerLastName">Last Name *</Label>
                <Input
                  id="customerLastName"
                  value={customerInfo.lastName}
                  onChange={(e) => setCustomerInfo({ ...customerInfo, lastName: e.target.value })}
                  placeholder="Enter last name"
                />
              </div>
              <div>
                <Label htmlFor="customerEmail">Email (Optional)</Label>
                <Input
                  id="customerEmail"
                  type="email"
                  value={customerInfo.email}
                  onChange={(e) => setCustomerInfo({ ...customerInfo, email: e.target.value })}
                  placeholder="Enter email address"
                />
              </div>
              <div className="flex gap-3 mt-6">
                <Button
                  onClick={() => {
                    setCustomerStep('phone');
                    setCustomerInfo({ ...customerInfo, firstName: '', lastName: '', email: '' });
                    setExistingCustomerID(null);
                  }}
                  variant="outline"
                  className="flex-1"
                  disabled={submitting}
                >
                  Back
                </Button>
                <Button
                  onClick={onSubmit}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  disabled={submitting || !customerInfo.firstName.trim() || !customerInfo.lastName.trim()}
                >
                  {statusMessage || (submitting ? 'Submitting...' : existingCustomerID ? 'Update & Complete' : 'Complete Order')}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}