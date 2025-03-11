"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import { Button } from "@/src/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/src/components/ui/form";
import { Input } from "@/src/components/ui/input";
import { Textarea } from "@/src/components/ui/textarea";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { InvoiceSchema, type InvoiceFormValues } from "@/src/schema/invoice";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { Separator } from "@/src/components/ui/separator";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Settings2,
  EyeOff,
  Eye,
} from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "@/src/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/src/components/ui/popover";
import { cn } from "@/src/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import { Switch } from "@/src/components/ui/switch";
import {
  Collapsible,
  CollapsibleContent,
} from "@/src/components/ui/collapsible";
import { MediaSelectorModal } from "@/src/app/(protected)/dashboard/media/_components/MediaSelectorModal";
import { BusinessInfoSkeleton } from "./business-info-skeleton";

import { Printer, Download, X } from "lucide-react";
import { InvoicePreview } from "./invoice-preview";
import Image from "next/image";
import { createInvoice } from "../../invoice.action";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { upsertCustomer } from "../../../customers/customer.action";

// Define the type for upsertCustomer
export type UpsertCustomerData = {
  name: string;
  email: string;
  phoneNumber?: string;
  address?: string;
  company?: string;
  companyLogo?: string;
  taxNumber?: string;
  billingAddress?: string;
  shippingAddress?: string;
  notes?: string;
};

export function InvoiceForm() {
  const { data: session } = useSession();
  const router = useRouter();
  const [showBusinessInfo, setShowBusinessInfo] = useState(false);
  const [showPaymentInfo, setShowPaymentInfo] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showBusinessLogoSelector, setShowBusinessLogoSelector] =
    useState(false);
  const [showCustomerLogoSelector, setShowCustomerLogoSelector] =
    useState(false);
  const [showAdditionalCustomerInfo, setShowAdditionalCustomerInfo] =
    useState(false);

  const [previewCustomerLogo, setPreviewCustomerLogo] = useState<string | null>(
    null
  );
  const [defaultBusinessLogo, setDefaultBusinessLogo] = useState<string | null>(
    null
  );
  const [customBusinessLogo, setCustomBusinessLogo] = useState<string | null>(
    null
  );
  const [isLoadingBusinessInfo, setIsLoadingBusinessInfo] = useState(true);

  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(InvoiceSchema),
    defaultValues: {
      items: [{ name: "", quantity: 1, unitPrice: 0 }],
      invoiceDate: new Date(),
      dueDate: new Date(),
      currency: "USD",
      language: "en",
      installmentOption: false,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  // Calculate totals
  const calculateTotals = () => {
    const items = form.getValues("items");
    const subtotal = items.reduce(
      (sum, item) => sum + (item.quantity || 0) * (item.unitPrice || 0),
      0
    );
    const discount = form.getValues("discount") || 0;
    const tax = form.getValues("tax") || 0;
    const discountAmount = (subtotal * discount) / 100;
    const taxAmount = ((subtotal - discountAmount) * tax) / 100;
    const total = subtotal - discountAmount + taxAmount;

    return {
      subtotal: isNaN(subtotal) ? 0 : subtotal,
      discountAmount: isNaN(discountAmount) ? 0 : discountAmount,
      taxAmount: isNaN(taxAmount) ? 0 : taxAmount,
      total: isNaN(total) ? 0 : total,
    };
  };

  const handleBusinessLogoSelect = async (file: File | null) => {
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCustomBusinessLogo(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCustomerLogoSelect = async (file: File | null) => {
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewCustomerLogo(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Fetch store data on mount
  useEffect(() => {
    const fetchStoreData = async () => {
      try {
        const response = await fetch("/api/store");
        const data = await response.json();

        if (data.store) {
          setDefaultBusinessLogo(data.store.logo);
          // Set business information from store data
          form.reset({
            ...form.getValues(),
            businessName: data.store.name || "",
            businessLogo: data.store.logo || "",
            businessAddress: data.store.address || "",
            businessPhone: data.store.phoneNumber || "",
            businessEmail: data.store.email || "",
            businessWebsite: data.store.website || "",
            businessTaxNumber: data.store.taxNumber || "",
            currency: data.store.currency || "USD",
            termsAndConditions: data.store.termsAndConditions || "",
          });
        }
      } catch (error) {
        console.error("Failed to fetch store data:", error);
        toast.error("Failed to load store data");
      } finally {
        setIsLoadingBusinessInfo(false);
      }
    };

    fetchStoreData();
  }, [form]);

  const onSubmit = async (values: InvoiceFormValues) => {
    try {
      // Create or find customer using server action
      const customer = await upsertCustomer({
        name: values.customerName,
        email: values.customerEmail,
        phoneNumber: values.customerPhone,
        address: values.customerAddress,
        company: values.customerCompany,
        companyLogo: values.customerLogo,
        taxNumber: values.customerTaxNumber,
        billingAddress: values.customerBillingAddress,
        shippingAddress: values.customerShippingAddress,
        notes: values.customerNotes,
      } as UpsertCustomerData);

      // Calculate totals for the invoice
      const totals = calculateTotals();

      // Create invoice using server action with all form data
      const invoice = await createInvoice({
        // Customer Information
        customerId: customer.id,

        // Business Information
        businessName: values.businessName,
        businessLogo: values.businessLogo,
        businessAddress: values.businessAddress,
        businessPhone: values.businessPhone,
        businessEmail: values.businessEmail,
        businessWebsite: values.businessWebsite,
        businessTaxNumber: values.businessTaxNumber,

        // Invoice Items
        items: values.items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          description: item.description,
          // Removed productId since it's not defined in the item type
        })),

        // Invoice Details
        invoiceDate: values.invoiceDate,
        dueDate: values.dueDate,
        currency: values.currency,
        language: values.language,
        referenceNumber: values.referenceNumber,
        purchaseOrderNumber: values.purchaseOrderNumber,
        salespersonName: values.salespersonName,

        // Financial Details
        subtotal: totals.subtotal,
        tax: values.tax || 0,
        discount: values.discount || 0,
        total: totals.total,
        paidAmount: values.paidAmount || 0,

        // Additional Information
        notes: values.notes,
        termsAndConditions: values.termsAndConditions,
        paymentMethod: values.paymentMethod,

        // Metadata
        createdById: session?.user?.id || "",
      });

      if (!invoice) {
        throw new Error("Failed to create invoice");
      }

      toast.success("Invoice created successfully!");
      router.push("/dashboard/invoices");
    } catch (error) {
      console.error("Failed to create invoice:", error);
      toast.error("Failed to create invoice");
    }
  };

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          {/* Business Information */}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle>Business Information</CardTitle>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowBusinessInfo(!showBusinessInfo)}
              >
                <Settings2 className="h-4 w-4" />
              </Button>
            </CardHeader>
            <Collapsible open={showBusinessInfo}>
              <CollapsibleContent>
                {isLoadingBusinessInfo ? (
                  <BusinessInfoSkeleton />
                ) : (
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-4">
                      {customBusinessLogo ? (
                        <div className="relative">
                          <img
                            src={customBusinessLogo}
                            alt="Business Logo"
                            className="h-20 w-auto"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute -right-2 -top-2"
                            onClick={() => {
                              setCustomBusinessLogo(null);
                              form.setValue(
                                "businessLogo",
                                defaultBusinessLogo || ""
                              );
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : defaultBusinessLogo ? (
                        <div className="flex items-center gap-3">
                          <Image
                            src={defaultBusinessLogo}
                            alt="Business Logo"
                            width={80}
                            height={80}
                            className="h-20 w-auto rounded-md"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className=""
                            onClick={() => setShowBusinessLogoSelector(true)}
                          >
                            <Settings2 className="h-4 w-4" />
                            Upload Custom Logo
                          </Button>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowBusinessLogoSelector(true)}
                        >
                          Upload Custom Logo
                        </Button>
                      )}
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="businessName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Business Name</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="businessTaxNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tax Number</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="businessAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Business Address</FormLabel>
                          <FormControl>
                            <Textarea {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid gap-4 md:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="businessPhone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Business Phone</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="businessEmail"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Business Email</FormLabel>
                            <FormControl>
                              <Input {...field} type="email" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                )}
              </CollapsibleContent>
            </Collapsible>
          </Card>

          {/* Customer Information */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle>Customer Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="customerName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="customerEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer Email</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="customerPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer Phone</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="customerAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer Address</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="flex flex-col space-y-4">
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <h4 className="text-sm font-medium">
                      Additional Information
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Add customer logo, shipping address and others data.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setShowAdditionalCustomerInfo(!showAdditionalCustomerInfo)
                    }
                  >
                    {showAdditionalCustomerInfo ? (
                      <span className="flex items-center gap-2">
                        <EyeOff /> Hide
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Eye />
                        Show
                      </span>
                    )}
                  </Button>
                </div>{" "}
              </div>{" "}
              {showAdditionalCustomerInfo && (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="flex items-center gap-4">
                      {previewCustomerLogo ? (
                        <div className="relative">
                          <Image
                            src={previewCustomerLogo}
                            alt="Customer Logo"
                            width={80}
                            height={80}
                            className="h-20 w-auto rounded-md"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute -right-2 -top-2"
                            onClick={() => {
                              setPreviewCustomerLogo(null);
                              form.setValue("customerLogo", "");
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowCustomerLogoSelector(true)}
                        >
                          Upload Company Logo
                        </Button>
                      )}
                    </div>
                    <FormField
                      control={form.control}
                      name="customerCompany"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company Name</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              className="rounded-md border-gray-300"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="customerTaxNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tax Number</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              className="rounded-md border-gray-300"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />{" "}
                  </div>
                  <FormField
                    control={form.control}
                    name="customerBillingAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Billing Address</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            className="rounded-md border-gray-300"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="customerShippingAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Shipping Address</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            className="rounded-md border-gray-300"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="customerNotes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            className="rounded-md border-gray-300"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Invoice Details */}
          <Card>
            <CardHeader>
              <CardTitle>Invoice Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 justify-start md:grid-cols-2 ">
                <FormField
                  control={form.control}
                  name="invoiceNumber"
                  render={({ field }) => (
                    <FormItem className="flex flex-col items-start justify-start">
                      <FormLabel>Invoice Number</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="invoiceDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Invoice Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) =>
                              date > new Date() || date < new Date("1900-01-01")
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid gap-4 justify-start md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="dueDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Due Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => date < new Date()}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem className="flex flex-col items-start justify-start">
                      <FormLabel className="">Currency</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select currency" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="EUR">EUR</SelectItem>
                          <SelectItem value="GBP">GBP</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Items */}
          <Card>
            <CardHeader>
              <CardTitle>Items</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {fields.map((field, index) => (
                <div key={field.id} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">Item {index + 1}</h4>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => remove(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    <FormField
                      control={form.control}
                      name={`items.${index}.name`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`items.${index}.quantity`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Quantity</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              {...field}
                              onChange={(e) =>
                                field.onChange(parseInt(e.target.value))
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`items.${index}.unitPrice`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Unit Price</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              {...field}
                              onChange={(e) =>
                                field.onChange(parseFloat(e.target.value))
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => append({ name: "", quantity: 1, unitPrice: 0 })}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Item
              </Button>

              {/* Totals */}
              <div className="mt-6 space-y-2 rounded-lg border p-4">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{calculateTotals().subtotal.toFixed(2)}</span>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="discount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Discount</FormLabel>
                        <div className="flex gap-2">
                          <FormControl>
                            <Select
                              onValueChange={(value) => {
                                field.onChange(
                                  value === "percentage"
                                    ? "percentage"
                                    : "fixed"
                                );
                              }}
                              defaultValue="percentage"
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="percentage">
                                  Percentage (%)
                                </SelectItem>
                                <SelectItem value="fixed">
                                  Fixed Amount
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="Amount"
                              onChange={(e) => {
                                const value = parseFloat(e.target.value);
                                field.onChange(value);
                              }}
                            />
                          </FormControl>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="tax"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tax</FormLabel>
                        <div className="flex gap-2">
                          <FormControl>
                            <Select
                              onValueChange={(value) => {
                                field.onChange(
                                  value === "percentage"
                                    ? "percentage"
                                    : "fixed"
                                );
                              }}
                              defaultValue="percentage"
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="percentage">
                                  Percentage (%)
                                </SelectItem>
                                <SelectItem value="fixed">
                                  Fixed Amount
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="Amount"
                              onChange={(e) => {
                                const value = parseFloat(e.target.value);
                                field.onChange(value);
                              }}
                            />
                          </FormControl>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="flex justify-between">
                  <span>Discount Amount:</span>
                  <span>{calculateTotals().discountAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax Amount:</span>
                  <span>{calculateTotals().taxAmount.toFixed(2)}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-bold">
                  <span>Total:</span>
                  <span>{calculateTotals().total.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Information */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle>Payment Information</CardTitle>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowPaymentInfo(!showPaymentInfo)}
              >
                {showPaymentInfo ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </CardHeader>
            <Collapsible open={showPaymentInfo}>
              <CollapsibleContent>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="paymentMethod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment Method</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select payment method" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="CASH">Cash</SelectItem>
                            <SelectItem value="BANK_TRANSFER">
                              Bank Transfer
                            </SelectItem>
                            <SelectItem value="CREDIT_CARD">
                              Credit Card
                            </SelectItem>
                            <SelectItem value="DEBIT_CARD">
                              Debit Card
                            </SelectItem>
                            <SelectItem value="CHEQUE">Cheque</SelectItem>
                            <SelectItem value="ONLINE">
                              Online Payment
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid gap-4 md:grid-cols-2 items-end">
                    <FormField
                      control={form.control}
                      name="paidAmount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Paid Amount</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              {...field}
                              onChange={(e) =>
                                field.onChange(parseFloat(e.target.value))
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="installmentOption"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border px-4 py-0 h-10">
                          <div className="">
                            <FormLabel className="text-base">
                              Installment Payment
                            </FormLabel>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          {/* Notes & Terms */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle>Notes & Terms</CardTitle>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowNotes(!showNotes);
                  setShowTerms(!showTerms);
                }}
              >
                {showNotes ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </CardHeader>
            <Collapsible open={showNotes}>
              <CollapsibleContent>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Additional Notes</FormLabel>
                        <FormControl>
                          <Textarea {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="termsAndConditions"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Terms & Conditions</FormLabel>
                        <FormControl>
                          <Textarea {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          {/* Add Preview Button before the Create Invoice button */}
          <div className="flex gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowPreview(true)}
            >
              Preview Invoice
            </Button>
            <Button type="submit">Create Invoice</Button>
          </div>
        </form>
      </Form>

      {/* Replace the old preview dialog with the new component */}
      <InvoicePreview
        open={showPreview}
        onOpenChange={setShowPreview}
        formValues={form.getValues()}
        businessLogo={customBusinessLogo || defaultBusinessLogo}
        customerLogo={previewCustomerLogo}
      />

      {/* Business Logo Selector */}
      <MediaSelectorModal
        open={showBusinessLogoSelector}
        onOpenChange={setShowBusinessLogoSelector}
        onMediaSelect={() => {}}
        onFileSelect={handleBusinessLogoSelect}
        allowedTypes={["upload"]}
        showLibrary={false}
        reset={false}
      />

      {/* Customer Logo Selector */}
      <MediaSelectorModal
        open={showCustomerLogoSelector}
        onOpenChange={setShowCustomerLogoSelector}
        onMediaSelect={() => {}}
        onFileSelect={handleCustomerLogoSelect}
        allowedTypes={["upload"]}
        showLibrary={false}
        reset={false}
      />
    </>
  );
}
