import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { OnEvent } from '@nestjs/event-emitter';
import { SendMailDto } from './dto/send-mail.dto';
import { SendForgotPasswordEmailEvent } from './events/mail.events';
import { MAIL_CONSTANTS } from './constants/mail.constants';
import { forgotPasswordTemplate } from './templates/forgot-password.template';

@Injectable()
export class MailService {
  constructor(private readonly mailerService: MailerService) {}

  async sendMail(options: SendMailDto): Promise<void> {
    await this.mailerService.sendMail({
      to: options.to,
      subject: options.subject,
      html: options.html,
    });
  }

  @OnEvent(MAIL_CONSTANTS.EVENTS.FORGOT_PASSWORD)
  async handleForgotPasswordEmail(payload: SendForgotPasswordEmailEvent) {
    const { email, fullName, resetLink, expiresIn } = payload;
    const html = forgotPasswordTemplate(fullName, resetLink, expiresIn);

    await this.sendMail({
      to: email,
      subject: 'Reset Password',
      html,
    });
  }
}
