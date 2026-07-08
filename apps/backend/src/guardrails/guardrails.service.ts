import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class GuardrailsService {
  constructor(@Inject(SupabaseClient) private readonly supabase: SupabaseClient) {}

  validateRefund = async (orderId: string, amount: number) => {
    
    const { data: order, error } = await this.supabase
    	.from('orders')
    	.select('total_amount, refunded_amount, status')
    	.eq('id', orderId)
    	.single();

    if (error) console.error('Supabase query error:', error.message);

    if (!order) throw new BadRequestException('Order not found');

    if (order.status === 'cancelled') {
      throw new BadRequestException('Cannot refund a cancelled order');
    }

    const alreadyRefunded = order.refunded_amount || 0;
    if (alreadyRefunded + amount > order.total_amount) {
      throw new BadRequestException(`Refund amount exceeds remaining balance. Max: ${order.total_amount - alreadyRefunded}`);
    }

    if (order.refunded_amount >= order.total_amount) {
      throw new BadRequestException('Order is already fully refunded');
    }

    return true;
  };

  async validateCancellation(orderId: string) {
    const { data: order } = await this.supabase
      .from('orders')
      .select('status')
      .eq('id', orderId)
      .single();

    if (order?.status === 'shipped' || order?.status === 'delivered') {
      throw new BadRequestException('Cannot cancel an order that has already shipped');
    }

    return true;
  }
}
