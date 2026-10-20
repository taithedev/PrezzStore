begin;
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
do $test$
declare owner uuid; store uuid; product uuid:=gen_random_uuid(); free_product uuid:=gen_random_uuid();
 coupon uuid:=gen_random_uuid(); ord uuid:=gen_random_uuid(); second_ord uuid:=gen_random_uuid(); free_ord uuid:=gen_random_uuid();
 n integer; ok boolean;
begin
 select owner_id,id into owner,store from public.prezzstore_stores where slug='zuzify';
 if owner is null then raise exception 'Test fixture requires official store'; end if;
 insert into public.prezzstore_products(id,store_id,title,slug,price_cents,kind,stock_quantity,published)
 values(product,store,'Verification fixture','verify-'||product,1000,'service',1,false),
       (free_product,store,'Free verification fixture','verify-'||free_product,0,'service',null,false);
 insert into public.prezzstore_discounts(id,code,percentage,max_uses) values(coupon,'TEST-'||upper(left(replace(coupon::text,'-',''),20)),10,1);
 insert into public.prezzstore_orders(id,buyer_id,seller_id,product_id,amount_cents,discount_id,stripe_session_id)
 values(ord,owner,owner,product,900,coupon,'cs_test_prezzstore_atomic'),
       (second_ord,owner,owner,product,900,null,'cs_test_prezzstore_atomic_second'),
       (free_ord,owner,owner,free_product,0,null,null);
 if not public.prezzstore_reserve_stock(ord) then raise exception 'Stock reservation failed'; end if;
 if not public.prezzstore_reserve_stock(ord) then raise exception 'Stock retry failed'; end if;
 if public.prezzstore_reserve_stock(second_ord) then raise exception 'Overselling allowed'; end if;
 if not public.prezzstore_claim_order_discount(ord) then raise exception 'Discount claim failed'; end if;
 if not public.prezzstore_claim_order_discount(ord) then raise exception 'Discount retry failed'; end if;
 select used_count into n from public.prezzstore_discounts where id=coupon;
 if n<>1 then raise exception 'Discount double counted'; end if;
 begin
  perform public.prezzstore_settle_order(ord,'paid','cs_test_prezzstore_atomic',owner,901);
  raise exception 'Wrong amount was accepted';
 exception when raise_exception then
  if sqlerrm='Wrong amount was accepted' then raise; end if;
 end;
 perform public.prezzstore_settle_order(ord,'paid','cs_test_prezzstore_atomic',owner,900);
 perform public.prezzstore_settle_order(ord,'paid','cs_test_prezzstore_atomic',owner,900);
 select count(*) into n from public.prezzstore_point_events where order_id=ord and reason='purchase';
 if n<>1 then raise exception 'Purchase points not idempotent'; end if;
 if public.prezzstore_settle_order(ord,'failed','cs_test_prezzstore_atomic') then raise exception 'Paid order expired'; end if;
 perform public.prezzstore_settle_order(ord,'refunded','cs_test_prezzstore_atomic');
 perform public.prezzstore_settle_order(ord,'refunded','cs_test_prezzstore_atomic');
 select stock_quantity into n from public.prezzstore_products where id=product;
 if n<>1 then raise exception 'Refund stock not idempotent'; end if;
 select coalesce(sum(points),0) into n from public.prezzstore_point_events where order_id=ord;
 if n<>0 then raise exception 'Refund points were not reversed'; end if;
 if public.prezzstore_settle_order(ord,'paid','cs_test_prezzstore_atomic',owner,900) then raise exception 'Refunded order reactivated'; end if;
 perform public.prezzstore_settle_order(free_ord,'paid');
 perform public.prezzstore_settle_order(free_ord,'paid');
 select count(*) into n from public.prezzstore_point_events where order_id=free_ord;
 if n<>0 then raise exception 'Free checkout earned points'; end if;
 if not public.prezzstore_claim_receipt(free_ord) then raise exception 'Receipt not claimed'; end if;
 if public.prezzstore_claim_receipt(free_ord) then raise exception 'Duplicate receipt claim'; end if;
 update public.prezzstore_order_receipt_emails set status='failed' where order_id=free_ord;
 if not public.prezzstore_claim_receipt(free_ord) then raise exception 'Failed receipt cannot retry'; end if;
 -- Verify failed checkout returns stock exactly once.
 if not public.prezzstore_reserve_stock(second_ord) then raise exception 'Released stock unavailable'; end if;
 perform public.prezzstore_settle_order(second_ord,'failed','cs_test_prezzstore_atomic_second');
 perform public.prezzstore_settle_order(second_ord,'failed','cs_test_prezzstore_atomic_second');
 select stock_quantity into n from public.prezzstore_products where id=product;
 if n<>1 then raise exception 'Failure stock not idempotent'; end if;
end $test$;
select 'passed: stock limits, duplicate payment/refund/expiry events, amount validation, free checkout, points reversal, receipt retries' as result;
rollback;