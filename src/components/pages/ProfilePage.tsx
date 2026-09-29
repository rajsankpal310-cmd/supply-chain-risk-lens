import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";

export function ProfilePage() {
  const { user, updateProfile, can } = useAuth();

  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [companyName, setCompanyName] = useState(user?.companyName ?? "");
  const [industry, setIndustry] = useState(user?.industry ?? "Auto Components");
  const [companySize, setCompanySize] = useState(user?.companySize ?? "51-200");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateProfile({
      fullName,
      companyName,
      industry,
      companySize,
      avatarInitials: fullName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
    });
    toast.success("Profile updated successfully");
  }

  const permissionsList = [
    { key: "data:upload", label: "Upload transaction data" },
    { key: "data:manage", label: "Manage & delete transactions" },
    { key: "simulation:run", label: "Run what-if scenario simulations" },
    { key: "recommendations:view", label: "View decision support recommendations" },
    { key: "reports:generate", label: "Generate & export reports" },
    { key: "settings:manage", label: "Manage workspace settings" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Profile & Access Control"
        description="View and update your personal user details, active workspace role, and authorized permissions."
      />

      <div className="grid gap-6 lg:grid-cols-3 max-w-4xl">
        {/* User Card Summary */}
        <Card className="p-6 flex flex-col items-center text-center space-y-3 lg:col-span-1">
          <Avatar className="size-20 text-xl font-semibold">
            <AvatarFallback className="bg-primary/15 text-primary">
              {user?.avatarInitials ?? "AD"}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="font-semibold text-lg">{user?.fullName}</h2>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
          </div>
          <Badge variant="outline" className="text-primary border-primary/40">
            {user?.role.replace("_", " ")}
          </Badge>
          <div className="border-t w-full pt-3 text-xs text-muted-foreground space-y-1">
            <p><span className="font-medium text-foreground">Company:</span> {user?.companyName}</p>
            <p><span className="font-medium text-foreground">Industry:</span> {user?.industry}</p>
          </div>
        </Card>

        {/* Profile Edit Form & Permissions */}
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-5">
            <form onSubmit={handleSubmit} className="space-y-4">
              <h2 className="text-sm font-semibold border-b pb-2">Edit Account Details</h2>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="prof-name" className="text-xs">Full Name</Label>
                  <Input id="prof-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="prof-email" className="text-xs">Email Address (Read-only)</Label>
                  <Input id="prof-email" value={user?.email ?? ""} disabled className="bg-muted/50" />
                </div>
                <div>
                  <Label htmlFor="prof-company" className="text-xs">Company Name</Label>
                  <Input id="prof-company" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="prof-industry" className="text-xs">Industry</Label>
                  <Input id="prof-industry" value={industry} onChange={(e) => setIndustry(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="prof-size" className="text-xs">Company Size</Label>
                  <Select value={companySize} onValueChange={setCompanySize}>
                    <SelectTrigger id="prof-size"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["1-10", "11-50", "51-200", "201-500", "500+"].map((s) => (
                        <SelectItem key={s} value={s}>{s} employees</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end border-t pt-3">
                <Button type="submit">Update Profile</Button>
              </div>
            </form>
          </Card>

          {/* Active Role Permissions */}
          <Card className="p-5 space-y-3">
            <h2 className="text-sm font-semibold border-b pb-2">Active Role Permissions ({user?.role})</h2>
            <div className="grid gap-2 sm:grid-cols-2 text-xs">
              {permissionsList.map((p) => {
                const granted = can(p.key as any);
                return (
                  <div key={p.key} className={`border rounded-lg p-2.5 flex items-center justify-between ${granted ? "border-risk-low/40 bg-risk-low/5 text-foreground" : "border-border/50 text-muted-foreground/60 opacity-60"}`}>
                    <span>{p.label}</span>
                    <span className="font-mono text-[10px] font-semibold">{granted ? "GRANTED" : "DENIED"}</span>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
