using System.ComponentModel.DataAnnotations;

namespace APS.Compartilhado.Modelos.Entidades;

/// <summary>
/// Entidade que representa um estado brasileiro
/// </summary>
public class Estado
{
    [Key]
    public int Id { get; set; }
    
    [Required]
    [StringLength(2)]
    public string Sigla { get; set; } = string.Empty;
    
    [Required]
    [StringLength(100)]
    public string Nome { get; set; } = string.Empty;
    
    [Required]
    [StringLength(50)]
    public string Regiao { get; set; } = string.Empty;
    
    public DateTime DataCriacao { get; set; } = DateTime.UtcNow;
    
    // Relacionamentos
    public virtual ICollection<Municipio> Municipios { get; set; } = new List<Municipio>();
}
