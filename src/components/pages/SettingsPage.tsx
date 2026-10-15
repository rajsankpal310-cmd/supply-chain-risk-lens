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
import { TeamManagementTab } from "@/components/settings/TeamManagementTab";
import { Sliders, Users } from "lucide-react";

export function SettingsPage() {
  const { user, updateProfile } = useAuth();

  const [activeTab, setActiveTab] = useState<"general" | "team">("general");

  // Form state
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

  function handleResetCache() {
    try {
      localStorage.removeItem("nexus-cfr.store");
    } catch {}
    toast.success("Workspace cache reset successfully");
    window.location.reload();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Administration & Workspace Settings"
        description="Configure organization preferences, manage team seats, and risk thresholds."
      />

      {/* Primary Tab Navigation */}
      <div className="flex items-center gap-2 border-b pb-3">
        <Button
          variant={activeTab === "general" ? "default" : "outline"}
          size="sm"
          className="text-xs font-semibold gap-1.5"
          onClick={() => setActiveTab("general")}
        >
          <Sliders className="size-3.5" /> General Preferences
        </Button>
        <Button
          variant={activeTab === "team" ? "default" : "outline"}
          size="sm"
          className="text-xs font-semibold gap-1.5"
          onClick={() => setActiveTab("team")}
        >
          <Users className="size-3.5" /> Team Management
        </Button>
      </div>

      {/* Tab 1: General Preferences */}
      {activeTab === "general" && (
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

          {/* Data & Cache Preferences */}
          <Card className="p-5 space-y-4">
            <h2 className="text-sm font-semibold border-b pb-2">Data & Cache Preferences</h2>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="set-latency-toggle" className="text-sm">Network Latency Emulation</Label>
                <p className="text-xs text-muted-foreground">Add simulated delay (320ms) for UI responsiveness testing.</p>
              </div>
              <Switch id="set-latency-toggle" checked={mockLatency} onCheckedChange={setMockLatency} />
            </div>
            <div className="border-t pt-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Reset Local Workspace Cache</p>
                <p className="text-xs text-muted-foreground">Clear cached client-side mutations and reload fresh analytical ledger.</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={handleResetCache}>
                Reset Cache
              </Button>
            </div>
          </Card>

          <div className="flex justify-end gap-2">
            <Button type="submit">Save Workspace Settings</Button>
          </div>
        </form>
      )}

      {/* Tab 2: Team Management */}
      {activeTab === "team" && <TeamManagementTab />}
    </div>
  );
}
