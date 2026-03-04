import { and, desc, eq, getTableColumns, ilike, or, sql } from "drizzle-orm";
import express from "express";
import {
  classes,
  departments,
  enrollments,
  subjects,
} from "../db/schema/index.js";
import { db } from "../db/index.js";
import { user } from "../db/schema/auth.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const { search, subject, teacher, page = 1, limit = 10 } = req.query;
    const currentPage = Math.max(1, parseInt(String(page), 10) || 1);
    const pageSize = Math.min(
      Math.max(1, parseInt(String(limit), 10) || 100),
      100
    );
    const offset = (currentPage - 1) * pageSize;

    const filterConditions = [];

    // 对于搜索框输入的场合
    if (search) {
      filterConditions.push(
        or(
          ilike(classes.name, `%${search}`),
          ilike(classes.inviteCode, `%${search}`)
        )
      );
    }
    // 对于其他下拉菜单的场合
    if (subject) {
      // java%script_ -> %java\%script\_%
      const subjectPattern = `%${String(subject).replace(/[%_]/g, "\\$&")}%`;
      filterConditions.push(ilike(subjects.name, subjectPattern));
    }
    if (teacher) {
      const teacherPattern = `%${String(teacher).replace(/[%_]/g, "\\$&")}%`;
      filterConditions.push(ilike(user.name, teacherPattern));
    }
    // 组合成搜索子句
    const whereClause =
      filterConditions.length > 0 ? and(...filterConditions) : undefined;

    // 开始查询数据库
    const countResult = await db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(classes)
      .leftJoin(subjects, eq(classes.subjectId, subjects.id))
      .leftJoin(user, eq(classes.teacherId, user.id))
      .where(whereClause);

    const totalCount = countResult[0]?.count ?? 0;

    const classesList = await db
      .select({
        ...getTableColumns(classes),
        subject: { ...getTableColumns(subjects) },
        teacher: { ...getTableColumns(user) },
      })
      .from(classes)
      .leftJoin(subjects, eq(classes.subjectId, subjects.id))
      .leftJoin(user, eq(classes.teacherId, user.id))
      .where(whereClause)
      .orderBy(desc(classes.createdAt))
      .limit(pageSize)
      .offset(offset);

    res.status(200).json({
      data: classesList,
      pagination: {
        page: currentPage,
        limit: pageSize,
        total: totalCount,
        totalPage: Math.ceil(totalCount / pageSize),
      },
    });
  } catch (error) {
    console.error(`GET /classes error:${error}`);
    res.status(500).json({
      error: "发生服务器错误，获取班级信息失败，请联系管理员或稍后再试。",
    });
  }
});

router.get("/:id", async (req, res) => {
  const classId = Number(req.params.id);
  if (!Number.isInteger(classId))
    return res.status(400).json({ error: "所查询的班级id参数应为整数" });

  const [classDetails] = await db
    .select({
      ...getTableColumns(classes),
      subject: { ...getTableColumns(subjects) },
      department: { ...getTableColumns(departments) },
      teacher: { ...getTableColumns(user) },
    })
    .from(classes)
    .leftJoin(subjects, eq(classes.subjectId, subjects.id))
    .leftJoin(user, eq(classes.teacherId, user.id))
    .leftJoin(departments, eq(subjects.departmentId, departments.id))
    .where(eq(classes.id, classId));
  if (!classDetails) return res.status(404).json({ error: "无结果" });
  res.status(200).json({ data: classDetails });
});

router.post("/", async (req, res) => {
  try {
    const {
      name,
      teacherId,
      subjectId,
      capacity,
      description,
      status,
      bannerUrl,
      bannerCldPubId,
    } = req.body;
    const [createdClass] = await db
      .insert(classes)
      .values({
        subjectId,
        inviteCode: Math.random().toString(36).substring(2, 9),
        name,
        teacherId,
        bannerCldPubId,
        bannerUrl,
        capacity,
        description,
        schedules: [],
        status,
      })
      .returning({ id: classes.id });
    if (!createdClass) throw Error;
    res.status(200).json({ data: createdClass });
  } catch (error) {
    console.error(`POST /classes error: ${error}`);
    res.status(500).json({
      message: "服务器错误：注册班级信息时失败，请联系管理员或稍后再试。",
      error,
    });
  }
});
router.get("/:id/users", async (req, res) => {
  try {
    const classId = Number(req.params.id);
    const { role, page = 1, limit = 10 } = req.query;

    if (!Number.isFinite(classId)) {
      return res.status(400).json({ error: "Invalid class id" });
    }

    if (role !== "teacher" && role !== "student") {
      return res.status(400).json({ error: "Invalid role" });
    }
    const currentPage = Math.max(1, +page);
    const pageSize = Math.max(1, +limit);
    const offset = (currentPage - 1) * pageSize;

    const baseSelect = {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      image: user.image,
      role: user.role,
      imageCldPubId: user.imageCldPubId,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    const groupByFields = [
      user.id,
      user.name,
      user.email,
      user.emailVerified,
      user.image,
      user.role,
      user.imageCldPubId,
      user.createdAt,
      user.updatedAt,
    ];

    const countResult =
      role === "teacher"
        ? await db
            .select({ count: sql<number>`count(distinct ${user.id})` })
            .from(user)
            .leftJoin(classes, eq(user.id, classes.teacherId))
            .where(and(eq(user.role, role), eq(classes.id, classId)))
        : await db
            .select({ count: sql<number>`count(distinct ${user.id})` })
            .from(user)
            .leftJoin(enrollments, eq(user.id, enrollments.studentId))
            .where(and(eq(user.role, role), eq(enrollments.classId, classId)));

    const totalCount = countResult[0]?.count ?? 0;

    const usersList =
      role === "teacher"
        ? await db
            .select(baseSelect)
            .from(user)
            .leftJoin(classes, eq(user.id, classes.teacherId))
            .groupBy(...groupByFields)
            .orderBy(desc(user.createdAt))
            .limit(pageSize)
            .offset(offset)
        : await db
            .select(baseSelect)
            .from(user)
            .leftJoin(enrollments, eq(user.id, enrollments.studentId))
            .where(and(eq(user.role, role), eq(enrollments.classId, classId)))
            .groupBy(...groupByFields)
            .orderBy(desc(user.createdAt))
            .limit(pageSize)
            .offset(offset);
    res.status(200).json({
      data: usersList,
      pagination: {
        page: currentPage,
        limit: pageSize,
        total: totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
      },
    });
  } catch (error) {
    console.error("GET /classes/:id/users error:", error);
    res.status(500).json({ error: "Failed to fetch class users" });
  }
});

export default router;
