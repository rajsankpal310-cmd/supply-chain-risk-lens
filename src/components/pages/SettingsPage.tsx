import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/context/AuthContext";

export function SettingsPage() {
  const { user, updateProfile } = useAuth();

  const [companyName, setCompanyName] = useState(user?.companyName ?? "Sundaram Auto Components");
  const [industry, setIndustry] = useState(user?.industry ?? "Auto Components");
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [criticalAlertsOnly, setCriticalAlertsOnly] = useState(false);
  const [highRiskThreshold, setHighRiskThreshold] = useState(65);
  const [currencyFormat, setCurrencyFormat] = useState("INR");
  const [mockLatency, setMockLatency] = useState(true);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    updateProfile({ companyName, industry });
    try {
      localStorage.setItem(
        "nexus-cfr.settings",
        JSON.stringify({ emailAlerts, criticalAlertsOnly, highRiskThreshold, currencyFormat, mockLatency })
      );
    } catch {}
    toast.success("Settings updated successfully");
  }

  function handleResetDemoData() {
    toast.success("Demo dataset reset to initial state");
    window.location.reload();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workspace Settings"
        description="Configure organization profile, risk thresholds, alert notifications, and demo environment preferences."
      />

      <form onSubmit={handleSave} className="space-y-6 max-w-4xl">
        {/* Organization Profile */}
        <Card className="p-5 space-y-4">
          <h2 className="text-sm font-semibold border-b pb-2">Organization Profile</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="set-company" className="text-xs">Company Name</Label>
              <Input id="set-company" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="set-industry" className="text-xs">Industry Segment</Label>
              <Input id="set-industry" value={industry} onChange={(e) => setIndustry(e.target.value)} />
            </div>
          </div>
        </Card>

        {/* Risk Threshold Preferences */}
        <Card className="p-5 space-y-4">
          <h2 className="text-sm font-semibold border-b pb-2">Risk Evaluation Thresholds</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="set-threshold" className="text-xs">High-Risk Score Trigger Threshold (0-100)</Label>
              <Input
                id="set-threshold"
                type="number"
                min={30}
                max={90}
                value={highRiskThreshold}
                onChange={(e) => setHighRiskThreshold(Number(e.target.value))}
              />
            </div>
            <div>
              <Label htmlFor="set-currency" className="text-xs">Display Currency Format</Label>
              <Select value={currencyFormat} onValueChange={setCurrencyFormat}>
                <SelectTrigger id="set-currency"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="INR">Indian Rupee (₹ INR / Lakhs / Crores)</SelectItem>
                  <SelectItem value="USD">US Dollar ($ USD)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* Notification Preferences */}
        <Card className="p-5 space-y-4">
          <h2 className="text-sm font-semibold border-b pb-2">Notification Preferences</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="set-email-toggle" className="text-sm">Email Risk Notifications</Label>
                <p className="text-xs text-muted-foreground">Receive instant alerts when a connected firm's risk level escalates.</p>
              </div>
              <Switch id="set-email-toggle" checked={emailAlerts} onCheckedChange={setEmailAlerts} />
            </div>
            <div className="flex items-center justify-between border-t pt-3">
              <div>
                <Label htmlFor="set-critical-toggle" className="text-sm">Critical Severity Only</Label>
                <p className="text-xs text-muted-foreground">Filter out medium and low priority notifications.</p>
              </div>
              <Switch id="set-critical-toggle" checked={criticalAlertsOnly} onCheckedChange={setCriticalAlertsOnly} />
            </div>
          </div>
        </Card>

        {/* Demo Environment Preferences */}
        <Card className="p-5 space-y-4">
          <h2 className="text-sm font-semibold border-b pb-2">Demo Dataset Preferences</h2>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="set-latency-toggle" className="text-sm">Simulate Network Latency</Label>
              <p className="text-xs text-muted-foreground">Add artificial delay (320ms) to exercise frontend loading states.</p>
            </div>
            <Switch id="set-latency-toggle" checked={mockLatency} onCheckedChange={setMockLatency} />
          </div>
          <div className="border-t pt-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Reset Demo Store</p>
              <p className="text-xs text-muted-foreground">Restore all mutated transactions, alerts, and recommendations to default seed data.</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={handleResetDemoData}>
              Reset Demo Data
            </Button>
          </div>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="submit">Save Workspace Settings</Button>
        </div>
      </form>
    </div>
  );
}
