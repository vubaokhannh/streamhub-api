export class SendForgotPasswordEmailEvent {
  constructor(
    public readonly email: string,
    public readonly fullName: string,
    public readonly resetLink: string,
    public readonly expiresIn: string,
  ) {}
}
