import {RegistrationDialog} from '@/components/ops/registration-dialog';
export interface DriverInviteDialogProps {open:boolean;onClose:()=>void;onCreated?:(id:string)=>void}
export function DriverInviteDialog(props:DriverInviteDialogProps){return <RegistrationDialog {...props} kind="driver"/>;}