import { NextRequest, NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { requireStaff } from "@/lib/auth";
import { Department, Employee, Service } from "@/lib/models";
import { cutoffOutsideHours, fail, invalidOfficers, parseBody, serviceRows } from "@/lib/route-helpers";
import { serviceSchema } from "@/lib/validators";

// GET /api/v1/services - services with department, officers and today's capacity (ADMIN)
//   ?departmentId=   ?includeInactive=true
export async function GET(req: NextRequest) {
  try {
    const auth = await requireStaff("ADMIN");
    if (auth.error) return auth.error;

    const params = req.nextUrl.searchParams;
    const departmentId = params.get("departmentId");
    if (departmentId && !isValidObjectId(departmentId)) return fail(400, "Invalid departmentId");

    const filter: Record<string, unknown> = {};
    if (departmentId) filter.departmentId = departmentId;
    if (params.get("includeInactive") !== "true") filter.isActive = true;

    return NextResponse.json({ success: true, services: await serviceRows(filter, new Date()) });
  } catch (error) {
    unstable_rethrow(error);
    console.error("GET /api/v1/services error:", error);
    return NextResponse.json({ error: "Failed to fetch services" }, { status: 500 });
  }
}

// POST /api/v1/services - create a service and assign its officers (ADMIN)
export async function POST(req: NextRequest) {
  try {
    const auth = await requireStaff("ADMIN");
    if (auth.error) return auth.error;

    const { data, error } = await parseBody(req, serviceSchema);
    if (error) return error;
    const { officerIds, ...fields } = data;

    const department = await Department.findById(fields.departmentId).select("workingHours").lean();
    if (!department) return fail(400, "Department not found");
    const badCutoff = cutoffOutsideHours(fields.cutoffTime, department.workingHours);
    if (badCutoff) return badCutoff;
    if (await Service.exists({ departmentId: fields.departmentId, code: fields.code })) {
      return fail(409, `Service code '${fields.code}' already exists in this department`);
    }
    const badOfficers = await invalidOfficers(fields.departmentId, officerIds);
    if (badOfficers) return badOfficers;

    const service = await Service.create(fields);
    await Employee.updateMany({ _id: { $in: officerIds } }, { $addToSet: { serviceIds: service._id } });
    // A new service has no queues yet, so there is nothing to recompute

    const [row] = await serviceRows({ _id: service._id }, new Date());
    return NextResponse.json({ success: true, service: row }, { status: 201 });
  } catch (error) {
    unstable_rethrow(error);
    if ((error as { code?: number }).code === 11000) {
      return fail(409, "Service code already exists in this department");
    }
    console.error("POST /api/v1/services error:", error);
    return NextResponse.json({ error: "Failed to create service" }, { status: 500 });
  }
}
