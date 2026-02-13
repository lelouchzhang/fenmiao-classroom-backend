DROP INDEX "enrollment_student_class_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "enrollment_student_class_unique" ON "enrollments" USING btree ("student_id","class_id");