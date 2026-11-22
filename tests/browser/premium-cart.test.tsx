// @vitest-environment happy-dom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CartView } from '@/components/shop/cart/cart-view';
import type { Cart } from '@/contracts';

const update = vi.fn();
const remove = vi.fn();
const fixtureCart: Cart = {
  id:'cart1',sessionId:'guest1',storeId:'dm-blr',
  lines:[{productId:'atta',quantity:2,name:'Whole Wheat Atta',unitPricePaise:24500}],
  totalPaise:49000,
};
let activeCart: Cart|null = fixtureCart;
vi.mock('@/lib/session/store-context',()=>({
  useStore:()=>({
    cart:activeCart,selectedStore:{id:'dm-blr',city:'Bengaluru',name:'Neighbourhood Kirana'},
    updateCartQuantity:update,removeFromCart:remove,isLoading:false
  })
}));
afterEach(()=>{activeCart=fixtureCart;update.mockClear();remove.mockClear();});

describe('premium cart presentation contracts',()=>{
  it('previews the 59-second window without claiming a live reservation',()=>{
    render(<CartView/>);
    expect(screen.getByText('00:59')).toBeInTheDocument();
    expect(screen.getByText(/Stock is not yet held/)).toBeInTheDocument();
    expect(screen.getByText(/does not reserve stock/)).toBeInTheDocument();
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
    expect(screen.getByRole('link',{name:/Proceed to checkout/i})).toHaveAttribute('href','/checkout');
    expect(screen.getByText('₹490')).toBeInTheDocument();
  });
  it('preserves increase, decrease, and removal actions',async()=>{
    const user=userEvent.setup();
    render(<CartView/>);
    await user.click(screen.getByRole('button',{name:'Increase quantity of Whole Wheat Atta'}));
    expect(update).toHaveBeenCalledWith('atta',3);
    await user.click(screen.getByRole('button',{name:'Decrease quantity of Whole Wheat Atta'}));
    expect(update).toHaveBeenCalledWith('atta',1);
    await user.click(screen.getByRole('button',{name:'Remove Whole Wheat Atta from cart'}));
    expect(remove).toHaveBeenCalledWith('atta');
  });
  it('keeps the empty-state path back to catalogue',()=>{
    activeCart=null;
    render(<CartView/>);
    expect(screen.getByRole('link',{name:/Explore the collection/i})).toHaveAttribute('href','/search');
    expect(screen.getByText(/Your bag is empty/)).toBeInTheDocument();
  });
});
