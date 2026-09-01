/** Tıbbi dosya: ilaçlar, alerjiler, teşhisler, doktorlar, notlar. */

export { MedicalFileView, type MedicalFileViewProps } from './medical-file-view';
export {
  healthRecordIssueMessage,
  medicationIssueMessage,
  medicationTaskPrefill,
  validateHealthRecordInput,
  validateMedicationInput,
  type HealthRecordIssue,
  type MedicationIssue,
} from './medical-input';
export {
  MedicalError,
  createHealthRecord,
  createMedication,
  listHealthRecords,
  listMedications,
  searchHealthRecords,
  type HealthRecordInput,
  type MedicalErrorCode,
  type MedicationInput,
} from './medical-repository';
export {
  healthRecordTypeLabel,
  healthRecordTypeSchema,
  isActiveMedication,
  toHealthRecord,
  toMedication,
  type HealthRecord,
  type HealthRecordType,
  type Medication,
} from './medical-schema';
export {
  medicalKeys,
  useCreateHealthRecord,
  useCreateMedication,
  useHealthRecordSearch,
  useHealthRecords,
  useMedications,
} from './use-medical';
