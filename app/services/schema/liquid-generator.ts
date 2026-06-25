export function generateProductLiquidSnippet(): string {
  return `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": {{ product.title | json }},
  "description": {{ product.description | strip_html | json }},
  "image": "{{ product.featured_image | image_url: width: 1200 }}",
  "brand": {
    "@type": "Brand",
    "name": {{ product.vendor | json }}
  },
  "sku": {{ product.selected_or_first_available_variant.sku | json }},
  "offers": {
    "@type": "Offer",
    "url": "{{ shop.url }}{{ product.url }}",
    "priceCurrency": {{ cart.currency.iso_code | json }},
    "price": {{ product.price | money_without_currency | remove: ',' | strip }},
    "availability": "{% if product.available %}https://schema.org/InStock{% else %}https://schema.org/OutOfStock{% endif %}"
  }
}
</script>`;
}
