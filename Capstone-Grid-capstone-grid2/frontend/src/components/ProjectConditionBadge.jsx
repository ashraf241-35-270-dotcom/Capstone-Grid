const CONDITION_CLASSES = {
  Draft: 'draft',
  'In Progress': 'in-progress',
  Submitted: 'submitted',
  'Changes Requested': 'changes-requested',
  Accepted: 'accepted',
  Archived: 'archived'
};

export default function ProjectConditionBadge({ status }) {
  const conditionClass = CONDITION_CLASSES[status] || 'other';

  return (
    <span className={`project-condition project-condition-${conditionClass}`}>
      {status}
    </span>
  );
}
