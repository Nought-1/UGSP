import { NextRequest, NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { requireStaff } from "@/lib/auth";
import { Department, Employee, Service } from "@/lib/models";
import { recomputeQueues } from "@/lib/recompute";
import { cutoffOutsideHours, fail, invalidOfficers, parseBody, serviceRows } from "@/lib/route-helpers";
import { servicePatchSchema } from "@/lib/validators";

type Context = { params: Promise<{ id: string }> };

const notFound = () => fail(404, "Service not found");

// GET /api/v1/services/[id] - one service with department, officers and today's capacity (ADMIN)
export async function GET(_req: NextRequest, { params }: Context) {
  try {
    const auth = await requireStaff("ADMIN");
    if (auth.error) return auth.error;

    const { id } = await params;
    if (!isValidObjectId(id)) return notFound();

    const [service] = await serviceRows({ _id: id }, new Date());
    return service ? NextResponse.json({ success: true, service }) : notFound();
  } catch (error) {
    unstable_rethrow(error);
    console.error("GET /api/v1/services/[id] error:", error);
    return NextResponse.json({ error: "Failed to fetch service" }, { status: 500 });
  }
}

// PATCH /api/v1/services/[id] - update any subset of fields, isActive or the officer list (ADMIN)
export async function PATCH(req: NextRequest, { params }: Context) {
  try {
    const auth = await requireStaff("ADMIN");
    if (auth.error) return auth.error;

    const { id } = await params;
    if (!isValidObjectId(id)) return notFound();

    const { data, error } = await parseBody(req, servicePatchSchema);
    if (error) return error;
    const { officerIds, ...changes } = data;

    const service = await Service.findById(id);
    if (!service) return notFound();

    if (changes.cutoffTime) {
      const department = await Department.findById(service.departmentId).select("workingHours").lean();
      const badCutoff = department && cutoffOutsideHours(changes.cutoffTime, department.workingHours);
      if (badCutoff) return badCutoff;
    }
    if (
      changes.code &&
      changes.code !== service.code &&
      (await Service.exists({ departmentId: service.departmentId, code: changes.code }))
    ) {
      return fail(409, `Service code '${changes.code}' already exists in this department`);
    }
    if (officerIds) {
      const badOfficers = await invalidOfficers(service.departmentId, officerIds);
      if (badOfficers) return badOfficers;
    }

    service.set(changes);
    await service.save();

    // The officer list is stored on each officer; admins who hold the service are left alone
    if (officerIds) {
      await Employee.updateMany(
        { role: "OFFICER", serviceIds: service._id, _id: { $nin: officerIds } },
        { $pull: { serviceIds: service._id } }
      );
      await Employee.updateMany({ _id: { $in: officerIds } }, { $addToSet: { serviceIds: service._id } });
    }

    // Average time, cutoff, limit, active and officers all change capacity: refresh queues from today on
    const now = new Date();
    const { conflicts } = await recomputeQueues({ serviceIds: [service._id] }, now);
    const [row] = await serviceRows({ _id: service._id }, now);

    return NextResponse.json({ success: true, service: row, conflicts });
  } catch (error) {
    unstable_rethrow(error);
    if ((error as { code?: number }).code === 11000) {
      return fail(409, "Service code already exists in this department");
    }
    console.error("PATCH /api/v1/services/[id] error:", error);
    return NextResponse.json({ error: "Failed to update service" }, { status: 500 });
  }
}
