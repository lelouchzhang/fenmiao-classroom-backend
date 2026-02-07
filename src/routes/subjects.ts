import { and, desc, eq, getTableColumns, ilike, or, sql } from "drizzle-orm";
import express from "express";
import { departments, subjects } from "../db/schema";
import { db } from "../db";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const { search, department, page = 1, limit = 10 } = req.query;
    // 数据预处理
    const currentPage = Math.max(1, parseInt(String(page), 10) || 1);
    const pageSize = Math.max(1, parseInt(String(limit), 10) || 100);
    const offset = (currentPage - 1) * pageSize;
    const filterConditions = [];
    // 构筑whereclause
    if (search) {
      filterConditions.push(
        or(
          ilike(subjects.name, `${search}%`),
          ilike(subjects.code, `${search}%`)
        )
      );
    }
    if (department) {
      const deptPattern = `${String(department).replace(/[%_]/g, "\\$&")}%`;
      filterConditions.push(ilike(departments.name, deptPattern));
    }
    const whereClause =
      filterConditions.length > 0 ? and(...filterConditions) : undefined;
    // be-db
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(subjects)
      .leftJoin(departments, eq(subjects.departmentId, departments.id))
      .where(whereClause);
    const totalCount = countResult[0]?.count ?? 0;

    const subjectsList = await db
      .select({
        ...getTableColumns(subjects),
        department: {
          ...getTableColumns(departments),
        },
      })
      .from(subjects)
      .leftJoin(departments, eq(subjects.departmentId, departments.id))
      .where(whereClause)
      .orderBy(desc(subjects.createdAt))
      .limit(pageSize)
      .offset(offset);

    // 构建响应
    res.status(200).json({
      data: subjectsList,
      pagination: {
        page: currentPage,
        limit: pageSize,
        total: totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
      },
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Server error when querying the /api/subjects" });
  }
});

export default router;
