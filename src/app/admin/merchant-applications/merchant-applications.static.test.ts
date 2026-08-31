import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

describe("admin merchant applications UI (static)", () => {
  it("protects list and detail routes with loadAdminContext", () => {
    const list = read("src/app/admin/merchant-applications/page.tsx");
    const detail = read(
      "src/app/admin/merchant-applications/[applicationId]/page.tsx",
    );

    expect(list).toContain('loadAdminContext("/admin/merchant-applications")');
    expect(detail).toContain("loadAdminContext(`/admin/merchant-applications/");
    expect(detail).toContain("notFound()");
  });

  it("loads applications from the admin repository", () => {
    const list = read("src/app/admin/merchant-applications/page.tsx");
    const detail = read(
      "src/app/admin/merchant-applications/[applicationId]/page.tsx",
    );

    expect(list).toContain("listMerchantApplicationsForAdmin");
    expect(detail).toContain("findMerchantApplicationById");
  });

  it("shows mutation forms only for pending applications", () => {
    const detail = read(
      "src/app/admin/merchant-applications/[applicationId]/page.tsx",
    );

    expect(detail).toContain('application.status === "PENDING"');
    expect(detail).toContain("ApplicationApproveForm");
    expect(detail).toContain("ApplicationRejectForm");
    expect(detail).toContain('application.status === "APPROVED"');
    expect(detail).toContain('application.status === "REJECTED"');

    const approvedSection = detail.slice(
      detail.indexOf("isApproved ?"),
      detail.indexOf("isRejected ?"),
    );
    const rejectedSection = detail.slice(
      detail.indexOf("isRejected ?"),
      detail.indexOf("isPending ?"),
    );
    expect(approvedSection).not.toContain("ApplicationApproveForm");
    expect(approvedSection).not.toContain("ApplicationRejectForm");
    expect(rejectedSection).not.toContain("ApplicationApproveForm");
    expect(rejectedSection).not.toContain("ApplicationRejectForm");
  });

  it("wires approve and reject server actions to application use cases", () => {
    const actions = read("src/app/admin/merchant-applications/actions.ts");
    const approveForm = read(
      "src/app/admin/merchant-applications/application-approve-form.tsx",
    );
    const rejectForm = read(
      "src/app/admin/merchant-applications/application-reject-form.tsx",
    );

    expect(actions).toContain("approveMerchantApplicationApp");
    expect(actions).toContain("rejectMerchantApplicationApp");
    expect(actions).not.toContain("reviewedByUserId");
    expect(actions).not.toContain("inviteMerchantOwnerApp");
    expect(approveForm).toContain("approveMerchantApplicationAction");
    expect(rejectForm).toContain("rejectMerchantApplicationAction");
    expect(approveForm).not.toContain("reviewedByUserId");
    expect(rejectForm).not.toContain("reviewedByUserId");
  });

  it("does not accept reviewer id from form data", () => {
    const actions = read("src/app/admin/merchant-applications/actions.ts");

    expect(actions).not.toMatch(/formData\.get\(["']reviewedByUserId["']\)/);
    expect(actions).not.toMatch(/formData\.get\(["']reviewer/i);
  });

  it("exposes merchantId after approve success for admin navigation", () => {
    const actions = read("src/app/admin/merchant-applications/actions.ts");
    const approveForm = read(
      "src/app/admin/merchant-applications/application-approve-form.tsx",
    );
    const actionState = read("src/app/admin/action-state.ts");

    expect(actionState).toContain("ApproveMerchantApplicationActionState");
    expect(actions).toContain("merchantId: result.value.merchant.id");
    expect(approveForm).toContain("state.merchantId");
    expect(approveForm).toContain(
      "router.push(`/admin/merchants/${state.merchantId}`)",
    );
  });

  it("adds Solicitudes to admin navigation", () => {
    const nav = read("src/app/admin/_components/admin-nav.tsx");

    expect(nav).toContain('label: "Solicitudes"');
    expect(nav).toContain('href: "/admin/merchant-applications"');
  });
});
