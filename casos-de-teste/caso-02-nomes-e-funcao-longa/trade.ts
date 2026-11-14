export function proc(d: any, u: any, flag: boolean, t: number, x: number, y: number) {
  let r = 0;
  if (d) {
    if (d.items) {
      for (let i = 0; i < d.items.length; i++) {
        if (d.items[i].st == 1) {
          if (flag) {
            r = r + d.items[i].v * 0.9;
          } else {
            r = r + d.items[i].v;
          }
        } else if (d.items[i].st == 2) {
          r = r + d.items[i].v * 0.5;
        }
      }
    }
  }
  // soma a taxa
  r = r + t;
  if (r > 5000) {
    r = r - 150;
  }
  if (u.type == 'SELLER') {
    r = r * 1.05;
  } else {
    if (u.type == 'CUSTOMER') {
      r = r * 1.0;
    }
  }
  // console.log(r)
  return r;
}
