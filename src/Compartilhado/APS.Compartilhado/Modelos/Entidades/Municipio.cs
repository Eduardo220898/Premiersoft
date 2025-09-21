using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace APS.Compartilhado.Modelos.Entidades;

/// <summary>
/// Entidade que representa um município brasileiro
/// </summary>
public class Municipio
{
    [Key]
    public int Id { get; set; }
    
    [Required]
    [StringLength(100)]
    public string Nome { get; set; } = string.Empty;
    
    [Required]
    [StringLength(10)]
    public string CodigoIBGE { get; set; } = string.Empty;
    
    [Column(TypeName = "decimal(10,7)")]
    public decimal Latitude { get; set; }
    
    [Column(TypeName = "decimal(10,7)")]
    public decimal Longitude { get; set; }
    
    public int Populacao { get; set; }
    
    public DateTime DataCriacao { get; set; } = DateTime.UtcNow;
    
    // Chave estrangeira
    [Required]
    public int EstadoId { get; set; }
    
    // Relacionamentos
    [ForeignKey("EstadoId")]
    public virtual Estado Estado { get; set; } = null!;
    
    public virtual ICollection<Hospital> Hospitais { get; set; } = new List<Hospital>();
    public virtual ICollection<Medico> Medicos { get; set; } = new List<Medico>();
    public virtual ICollection<Paciente> Pacientes { get; set; } = new List<Paciente>();
}
